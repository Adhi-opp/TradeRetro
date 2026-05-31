"""
SimulationEngine — Core Backtesting Engine
==========================================
Faithful port of server/src/engine/SimulationEngine.js.

Event-driven, sequential candle processing with:
- No look-ahead bias
- Indian transaction cost model (STT, brokerage, slippage)
- Deterministic seeded PRNG for reproducible results
- Net + Gross metric tracking for cost toggle
"""

import math
import numpy as np

from engine.costs import create_seeded_rng, calculate_indian_costs
from engine.indicators import (
    compute_rsi, compute_macd, compute_sma, compute_bollinger_bands,
    compute_donchian_channel,
)
from engine.strategies import (
    evaluate_ma_crossover, evaluate_rsi, evaluate_macd,
    evaluate_bollinger_breakout, evaluate_donchian_breakout,
)
from engine import metrics as m


def _js_round2(x: float) -> float:
    """Replicate JS Math.round(x * 100) / 100 (rounds 0.5 up, not banker's)."""
    return math.floor(x * 100 + 0.5) / 100


class SimulationEngine:
    """
    Core backtest engine. Processes OHLC data sequentially,
    evaluates strategy signals, executes trades, and tracks portfolio state.
    """

    def __init__(
        self,
        market_data: list[dict],
        initial_capital: float,
        strategy_config: dict,
        visible_start_index: int = 0,
    ):
        if not market_data:
            raise ValueError("Invalid OHLC data: must be non-empty array")
        if initial_capital <= 0:
            raise ValueError("Initial capital must be positive")
        if visible_start_index < 0 or visible_start_index >= len(market_data):
            raise ValueError("visible_start_index must point to a valid candle in market_data")

        self.market_data = market_data
        self.visible_start_index = visible_start_index
        self.visible_market_data = market_data[visible_start_index:]
        self.initial_capital = initial_capital
        self.strategy_config = strategy_config

        params = strategy_config.get("params", {})

        # Seeded RNG
        seed = params.get("seed")
        if seed is not None:
            self.rng = create_seeded_rng(seed)
        else:
            import random
            self.rng = random.random
        self.seed = seed

        # Risk model (optional). When both are set, positions are sized so a
        # stop-out costs exactly `risk_pct` of equity:
        #     position_value = (risk_pct * equity) / stop_loss_pct
        # When unset, the engine falls back to all-in / no-stop (legacy).
        self.risk_pct = params.get("riskPct")          # e.g. 0.02 = risk 2%/trade
        self.stop_loss_pct = params.get("stopLossPct")  # e.g. 0.05 = 5% stop
        self.risk_managed = bool(self.risk_pct and self.stop_loss_pct)

        # Portfolio state
        self.cash = initial_capital
        self.holdings = 0
        self.entry_price = None
        self.entry_date = None
        self.stop_price = None  # active stop level while holding (risk model)

        # Results tracking
        self.trades = []
        self.equity_curve = []

        # Cost tracking
        self.total_costs = {
            "stt": 0.0, "brokerage": 0.0, "slippage": 0.0,
            "exchangeTxn": 0.0, "gst": 0.0, "sebiFee": 0.0,
            "stampDuty": 0.0, "grossTotal": 0.0,
        }

        # Drawdown tracking
        self.high_water_mark = initial_capital
        self.max_drawdown = 0.0
        self.gross_high_water_mark = initial_capital
        self.gross_max_drawdown = 0.0

    def run(self) -> dict:
        """
        Execute the backtest and return the full report.

        Execution model — NEXT-BAR-OPEN fills (no look-ahead):
          A signal is computed from candle[i]'s CLOSE, but the order is not
          filled on the same bar — you can't trade at a close you only learn
          once the bar is over. Instead the order is queued and filled at
          candle[i+1]'s OPEN. A signal on the final bar simply never fills,
          which is the honest outcome.
        """
        close_prices = np.array([c["close"] for c in self.market_data], dtype=np.float64)
        indicators = self._calculate_indicators(close_prices)

        pending_signal = None  # "BUY" | "SELL" | None — queued from prior bar

        for i, candle in enumerate(self.market_data):
            if i < self.visible_start_index:
                continue

            # 1. Fill any order queued on the previous bar, at THIS bar's open.
            if pending_signal == "BUY" and self.holdings == 0 and self.cash > 0:
                self._execute_buy(candle["open"], candle["date"])
            elif pending_signal == "SELL" and self.holdings > 0:
                self._execute_sell(candle["open"], candle["date"])
            pending_signal = None

            # 1b. Stop-loss (risk model). A stop is a resting order placed at
            # entry, so it can fill on the SAME bar — that's not look-ahead.
            # If the bar gapped open below the stop, fill at the open (worse);
            # otherwise fill at the stop level.
            if self.holdings > 0 and self.stop_price is not None and candle["low"] <= self.stop_price:
                fill = min(candle["open"], self.stop_price)
                self._execute_sell(fill, candle["date"], exit_reason="stop")

            # 2. Mark-to-market at this bar's close (after any fill above).
            portfolio_value = self._portfolio_value(candle)
            gross_equity = portfolio_value + self.total_costs["grossTotal"]

            self.equity_curve.append({
                "date": candle["date"],
                "equity": portfolio_value,
                "grossEquity": gross_equity,
                "cash": self.cash,
                "holdings": self.holdings,
                "price": candle["close"],
            })

            self._update_drawdown(portfolio_value)
            self._update_gross_drawdown(gross_equity)

            # 3. Evaluate the signal on this bar's close, queue it for next bar.
            signal = self._evaluate_strategy(candle, indicators, i)
            if signal == "BUY" and self.holdings == 0:
                pending_signal = "BUY"
            elif signal == "SELL" and self.holdings > 0:
                pending_signal = "SELL"

        # Force close remaining position at the last available close (no next
        # bar to open into).
        if self.holdings > 0:
            last = self.visible_market_data[-1]
            self._execute_sell(last["close"], last["date"], exit_reason="force_close")

        return self._generate_report()

    def _calculate_indicators(self, close_prices: np.ndarray) -> dict:
        """Compute technical indicators based on strategy type."""
        strategy_type = self.strategy_config["strategyType"]
        params = self.strategy_config.get("params", {})

        if strategy_type == "MOVING_AVERAGE_CROSSOVER":
            short_period = params["shortPeriod"]
            long_period = params["longPeriod"]
            short_sma = compute_sma(close_prices, short_period)
            long_sma = compute_sma(close_prices, long_period)
            return {
                "shortSMA": short_sma,
                "longSMA": long_sma,
                "shortOffset": short_period - 1,
                "longOffset": long_period - 1,
            }

        if strategy_type == "RSI":
            rsi_period = params["rsiPeriod"]
            rsi_values = compute_rsi(close_prices, rsi_period)
            return {"rsi": rsi_values, "rsiOffset": rsi_period}

        if strategy_type == "MACD":
            macd_values = compute_macd(close_prices)
            return {
                "macd": macd_values,
                "macdOffset": len(close_prices) - len(macd_values),
            }

        if strategy_type == "BOLLINGER_BREAKOUT":
            bb_period = params.get("bbPeriod", 20)
            bb_std = params.get("bbStdDev", 2.0)
            bb_values = compute_bollinger_bands(close_prices, bb_period, bb_std)
            return {
                "bb": bb_values,
                "bbOffset": bb_period - 1,
            }

        if strategy_type == "DONCHIAN_BREAKOUT":
            high_prices = np.array([c["high"] for c in self.market_data], dtype=np.float64)
            low_prices = np.array([c["low"] for c in self.market_data], dtype=np.float64)
            dc_period = params.get("dcPeriod", 20)
            donchian_values = compute_donchian_channel(high_prices, low_prices, dc_period)
            return {
                "donchian": donchian_values,
                "close": close_prices,
            }

        raise ValueError(f"Unknown strategy type: {strategy_type}")

    def _evaluate_strategy(self, candle: dict, indicators: dict, index: int) -> str:
        """Route to the correct strategy evaluator."""
        strategy_type = self.strategy_config["strategyType"]
        params = self.strategy_config.get("params", {})

        if strategy_type == "MOVING_AVERAGE_CROSSOVER":
            return evaluate_ma_crossover(indicators, index)

        if strategy_type == "RSI":
            return evaluate_rsi(
                indicators, index,
                oversold=params.get("oversold", 30),
                overbought=params.get("overbought", 70),
            )

        if strategy_type == "MACD":
            return evaluate_macd(indicators, index)

        if strategy_type == "BOLLINGER_BREAKOUT":
            return evaluate_bollinger_breakout(indicators, index)

        if strategy_type == "DONCHIAN_BREAKOUT":
            return evaluate_donchian_breakout(indicators, index)

        raise ValueError(f"Unknown strategy type: {strategy_type}")

    def _target_shares(self, price: float) -> int:
        """
        Number of shares to buy at `price`.

        Risk model (risk_pct + stop_loss_pct set): size the position so that
        hitting the stop loses exactly `risk_pct` of equity —
            position_value = (risk_pct * equity) / stop_loss_pct
        Legacy (unset): deploy all available cash. Both are capped at what the
        cash on hand can afford, including a transaction-cost buffer.
        """
        approx_cost_rate = 0.003
        affordable = int(self.cash // (price * (1 + approx_cost_rate)))
        if not self.risk_managed:
            return affordable
        # Flat at entry, so equity == cash.
        position_value = (self.risk_pct * self.cash) / self.stop_loss_pct
        target = int(position_value // price)
        return max(0, min(target, affordable))

    def _execute_buy(self, price: float, date):
        """Execute a buy order at the given fill price with Indian costs."""
        max_shares = self._target_shares(price)
        if max_shares == 0:
            return

        trade_value = max_shares * price
        costs = calculate_indian_costs(trade_value, "BUY", self.rng)
        total_cost = trade_value + costs["total"]

        if total_cost > self.cash:
            return

        # Accumulate costs
        for key in ("stt", "brokerage", "slippage", "exchangeTxn", "gst", "sebiFee", "stampDuty"):
            self.total_costs[key] += costs[key]
        self.total_costs["grossTotal"] += costs["total"]

        self.cash -= total_cost
        self.holdings = max_shares
        self.entry_price = price
        self.entry_date = date
        # Arm the stop for this position (risk model only).
        self.stop_price = price * (1 - self.stop_loss_pct) if self.risk_managed else None

    def _execute_sell(self, price: float, date, exit_reason: str = "signal"):
        """
        Execute a sell order at the given fill price with Indian costs.

        exit_reason: "signal" (strategy SELL), "stop" (stop-loss hit), or
        "force_close" (open position closed at end of data).
        """
        if self.holdings == 0:
            return

        proceeds = self.holdings * price

        costs = calculate_indian_costs(proceeds, "SELL", self.rng)
        net_proceeds = proceeds - costs["total"]
        total_fee = costs["total"]

        # Accumulate costs
        for key in ("stt", "brokerage", "slippage", "exchangeTxn", "gst"):
            self.total_costs[key] += costs[key]
        self.total_costs["grossTotal"] += costs["total"]

        profit_loss = (price - self.entry_price) * self.holdings - total_fee
        gross_profit_loss = (price - self.entry_price) * self.holdings
        pnl_pct = ((price - self.entry_price) / self.entry_price) * 100
        holding_period = self._days_between(self.entry_date, date)

        self.trades.append({
            "type": "LONG",
            "entryDate": self.entry_date,
            "entryPrice": self.entry_price,
            "exitDate": date,
            "exitPrice": price,
            "shares": self.holdings,
            "profitLoss": profit_loss,
            "grossProfitLoss": gross_profit_loss,
            "pnlPct": pnl_pct,
            "holdingPeriod": holding_period,
            "fee": total_fee,
            "isWin": profit_loss > 0,
            "isGrossWin": gross_profit_loss > 0,
            "forceClose": exit_reason == "force_close",
            "exitReason": exit_reason,
        })

        self.cash += net_proceeds
        self.holdings = 0
        self.entry_price = None
        self.entry_date = None
        self.stop_price = None

    def _portfolio_value(self, candle: dict) -> float:
        return self.cash + self.holdings * candle["close"]

    def _update_drawdown(self, current_value: float):
        if current_value > self.high_water_mark:
            self.high_water_mark = current_value
        dd = (current_value - self.high_water_mark) / self.high_water_mark
        if dd < self.max_drawdown:
            self.max_drawdown = dd

    def _update_gross_drawdown(self, gross_value: float):
        if gross_value > self.gross_high_water_mark:
            self.gross_high_water_mark = gross_value
        dd = (gross_value - self.gross_high_water_mark) / self.gross_high_water_mark
        if dd < self.gross_max_drawdown:
            self.gross_max_drawdown = dd

    @staticmethod
    def _days_between(start_date, end_date) -> int:
        """Calculate days between two date strings or date objects."""
        from datetime import datetime, date
        if isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date).date() if "T" in start_date else date.fromisoformat(start_date)
        if isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date).date() if "T" in end_date else date.fromisoformat(end_date)
        if isinstance(start_date, datetime):
            start_date = start_date.date()
        if isinstance(end_date, datetime):
            end_date = end_date.date()
        return abs((end_date - start_date).days)

    def _generate_report(self) -> dict:
        """Generate the final report matching SimulationEngine.js output exactly."""
        equity_values = np.array([p["equity"] for p in self.equity_curve], dtype=np.float64)
        gross_equity_values = np.array([p["grossEquity"] for p in self.equity_curve], dtype=np.float64)
        close_prices = np.array([c["close"] for c in self.visible_market_data], dtype=np.float64)

        final_value = self.equity_curve[-1]["equity"] if self.equity_curve else self.initial_capital
        gross_final_value = self.equity_curve[-1]["grossEquity"] if self.equity_curve else self.initial_capital

        total_return = ((final_value - self.initial_capital) / self.initial_capital) * 100
        gross_total_return = ((gross_final_value - self.initial_capital) / self.initial_capital) * 100

        winning_trades = sum(1 for t in self.trades if t["isWin"])
        gross_winning_trades = sum(1 for t in self.trades if t["isGrossWin"])
        num_trades = len(self.trades)

        win_rate = (winning_trades / num_trades * 100) if num_trades > 0 else 0
        gross_win_rate = (gross_winning_trades / num_trades * 100) if num_trades > 0 else 0

        avg_pnl = (sum(t["profitLoss"] for t in self.trades) / num_trades) if num_trades > 0 else 0
        avg_holding = (sum(t["holdingPeriod"] for t in self.trades) / num_trades) if num_trades > 0 else 0

        # Time-in-market: % of bars actually holding a position. Makes the
        # Sharpe figure honest — a "Sharpe 1.8 at 22% exposure" strategy is
        # sitting in cash most of the time, which the cash-inclusive Sharpe
        # would otherwise hide.
        exposure_bars = sum(1 for p in self.equity_curve if p["holdings"] > 0)
        exposure_pct = (exposure_bars / len(self.equity_curve) * 100) if self.equity_curve else 0.0

        initial_price = self.visible_market_data[0]["close"]
        final_price = self.visible_market_data[-1]["close"]
        buy_hold_return = ((final_price - initial_price) / initial_price) * 100

        n = len(self.visible_market_data)
        years = n / 252

        strategy_cagr = m.cagr(self.initial_capital, final_value, n)
        bench_cagr = m.benchmark_cagr(initial_price, final_price, n)
        gross_cagr = (pow(gross_final_value / self.initial_capital, 1 / years) - 1) * 100 if years > 0 else 0

        # Serialize dates as strings
        def _date_str(d) -> str:
            if hasattr(d, "isoformat"):
                return d.isoformat()
            return str(d)

        # Serialize equity curve dates
        serialized_equity = []
        for point in self.equity_curve:
            serialized_equity.append({
                "date": _date_str(point["date"]),
                "equity": point["equity"],
                "grossEquity": point["grossEquity"],
                "cash": point["cash"],
                "holdings": point["holdings"],
                "price": point["price"],
            })

        # Serialize trade dates
        serialized_trades = []
        for t in self.trades:
            serialized_trades.append({
                **t,
                "entryDate": _date_str(t["entryDate"]),
                "exitDate": _date_str(t["exitDate"]),
            })

        return {
            "metrics": {
                "initialCapital": self.initial_capital,
                "finalValue": final_value,
                "totalReturn": total_return,
                "totalReturnRupee": final_value - self.initial_capital,
                "buyHoldReturn": buy_hold_return,
                "sharpeRatio": m.sharpe_ratio(equity_values),
                "maxDrawdown": self.max_drawdown * 100,
                "cagr": strategy_cagr,
                "benchmarkCagr": bench_cagr,
                "alpha": m.alpha(strategy_cagr, bench_cagr),
                "informationRatio": m.information_ratio(equity_values, close_prices),
                "totalTrades": num_trades,
                "winningTrades": winning_trades,
                "losingTrades": num_trades - winning_trades,
                "winRate": win_rate,
                "avgProfitLoss": avg_pnl,
                "avgHoldingPeriod": avg_holding,
                "exposurePct": exposure_pct,
                "startDate": _date_str(self.visible_market_data[0]["date"]),
                "endDate": _date_str(self.visible_market_data[-1]["date"]),
                "totalDays": n,
            },
            "grossMetrics": {
                "finalValue": gross_final_value,
                "totalReturn": gross_total_return,
                "totalReturnRupee": gross_final_value - self.initial_capital,
                "maxDrawdown": self.gross_max_drawdown * 100,
                "cagr": gross_cagr,
                "alpha": gross_cagr - bench_cagr,
                "winRate": gross_win_rate,
                "winningTrades": gross_winning_trades,
            },
            "costBreakdown": {
                "stt": _js_round2(self.total_costs["stt"]),
                "brokerage": _js_round2(self.total_costs["brokerage"]),
                "slippage": _js_round2(self.total_costs["slippage"]),
                "exchangeFees": _js_round2(self.total_costs["exchangeTxn"]),
                "gst": _js_round2(self.total_costs["gst"]),
                "stampDuty": _js_round2(self.total_costs["stampDuty"]),
                "totalCosts": _js_round2(self.total_costs["grossTotal"]),
                "costPctOfCapital": _js_round2((self.total_costs["grossTotal"] / self.initial_capital) * 100),
            },
            "equityCurve": serialized_equity,
            "trades": serialized_trades,
            "strategy": self.strategy_config,
            "simulationMeta": {
                "dataSource": "postgresql_medallion",
                "regimeModel": "3_state_markov",
                "costModel": "INDIA_EQUITY",
                "seed": self.seed,
                "transactionCostModel": "india_equity_v1",
            },
        }
