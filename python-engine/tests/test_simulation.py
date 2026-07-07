"""
Tests for engine/simulation.py — End-to-End Backtest
=====================================================
Feed static, known OHLCV data into SimulationEngine and verify
the full report structure and key metric values.
"""

import pytest

from engine.simulation import SimulationEngine
from models.responses import BacktestResponse


# ── Fixtures ─────────────────────────────────────────────────────────────────

def _make_candle(date: str, close: float, open_: float = None, high: float = None, low: float = None):
    o = open_ or close
    h = high or close
    lo = low or close
    return {"date": date, "open": o, "high": h, "low": lo, "close": close, "volume": 100_000}


def _rising_market(n: int = 300, start_price: float = 100.0, daily_pct: float = 0.002):
    """Generate n candles with steady daily growth."""
    candles = []
    price = start_price
    for i in range(n):
        day = f"2023-{1 + i // 28:02d}-{1 + i % 28:02d}"
        candles.append(_make_candle(day, round(price, 2)))
        price *= (1 + daily_pct)
    return candles


def _crossover_market():
    """
    Generate 300 candles where:
    - First 150: price rises from 100 → 200 (short SMA > long SMA → BUY)
    - Next 50: price drops from 200 → 120 (death cross → SELL)
    - Last 100: price recovers from 120 → 180
    """
    candles = []
    prices = (
        [100 + i * (100 / 150) for i in range(150)]    # Rise
        + [200 - i * (80 / 50) for i in range(50)]     # Drop
        + [120 + i * (60 / 100) for i in range(100)]   # Recovery
    )
    for i, price in enumerate(prices):
        day = f"2023-{1 + i // 28:02d}-{1 + i % 28:02d}"
        candles.append(_make_candle(day, round(price, 2)))
    return candles


def _crash_market():
    """
    A V then a crash, sized for a 5/20 SMA crossover:
      - decline 100→90 (sets short SMA below long SMA)
      - sharp rise 90→140 (short crosses UP through long → real golden cross → BUY)
      - violent -12%/bar crash (blows a 5% stop within a bar, before the
        faster SMA can produce a death cross → exit is a stop, not a signal)
      - mild tail
    """
    prices = [100 - i * (10 / 25) for i in range(25)]      # decline 100 → 90
    last = prices[-1]
    prices += [last + i * (50 / 25) for i in range(25)]    # rise 90 → ~140
    p = prices[-1]
    for _ in range(10):                                     # crash -12%/bar
        p *= 0.88
        prices.append(p)
    for _ in range(15):                                     # tail
        p *= 1.005
        prices.append(p)
    candles = []
    for i, price in enumerate(prices):
        day = f"2023-{1 + i // 28:02d}-{1 + i % 28:02d}"
        candles.append(_make_candle(day, round(price, 2)))
    return candles


# ── Report Structure Tests ───────────────────────────────────────────────────

class TestReportStructure:
    """Verify the engine output matches the Pydantic contract exactly."""

    def test_ma_crossover_report_validates(self):
        """MA Crossover backtest report passes Pydantic validation."""
        data = _rising_market(300)
        engine = SimulationEngine(data, 100_000, {
            "strategyType": "MOVING_AVERAGE_CROSSOVER",
            "params": {"shortPeriod": 20, "longPeriod": 50, "initialCapital": 100_000},
        })
        result = engine.run()
        # This will raise ValidationError if any field is missing/wrong type
        BacktestResponse.model_validate(result)

    def test_rsi_report_validates(self):
        """RSI backtest report passes Pydantic validation."""
        data = _crossover_market()
        engine = SimulationEngine(data, 100_000, {
            "strategyType": "RSI",
            "params": {"rsiPeriod": 14, "oversold": 30, "overbought": 70, "initialCapital": 100_000},
        })
        result = engine.run()
        BacktestResponse.model_validate(result)

    def test_macd_report_validates(self):
        """MACD backtest report passes Pydantic validation."""
        data = _crossover_market()
        engine = SimulationEngine(data, 100_000, {
            "strategyType": "MACD",
            "params": {"initialCapital": 100_000},
        })
        result = engine.run()
        BacktestResponse.model_validate(result)


# ── Metric Sanity Tests ──────────────────────────────────────────────────────

class TestMetricSanity:
    """Verify that metrics are mathematically consistent."""

    def test_initial_capital_preserved(self):
        data = _rising_market(300)
        engine = SimulationEngine(data, 100_000, {
            "strategyType": "MOVING_AVERAGE_CROSSOVER",
            "params": {"shortPeriod": 20, "longPeriod": 50, "initialCapital": 100_000},
        })
        result = engine.run()
        assert result["metrics"]["initialCapital"] == 100_000

    def test_total_trades_matches_trade_array(self):
        data = _crossover_market()
        engine = SimulationEngine(data, 100_000, {
            "strategyType": "MOVING_AVERAGE_CROSSOVER",
            "params": {"shortPeriod": 20, "longPeriod": 50, "initialCapital": 100_000},
        })
        result = engine.run()
        assert result["metrics"]["totalTrades"] == len(result["trades"])

    def test_winning_plus_losing_equals_total(self):
        data = _crossover_market()
        engine = SimulationEngine(data, 100_000, {
            "strategyType": "MOVING_AVERAGE_CROSSOVER",
            "params": {"shortPeriod": 20, "longPeriod": 50, "initialCapital": 100_000},
        })
        result = engine.run()
        m = result["metrics"]
        assert m["winningTrades"] + m["losingTrades"] == m["totalTrades"]

    def test_equity_curve_length_matches_visible_candles(self):
        data = _rising_market(300)
        engine = SimulationEngine(data, 100_000, {
            "strategyType": "MOVING_AVERAGE_CROSSOVER",
            "params": {"shortPeriod": 20, "longPeriod": 50, "initialCapital": 100_000},
        })
        result = engine.run()
        assert len(result["equityCurve"]) == 300

    def test_total_return_matches_equity_curve(self):
        """totalReturn should match (finalEquity - initial) / initial * 100."""
        data = _crossover_market()
        engine = SimulationEngine(data, 100_000, {
            "strategyType": "MOVING_AVERAGE_CROSSOVER",
            "params": {"shortPeriod": 20, "longPeriod": 50, "initialCapital": 100_000},
        })
        result = engine.run()
        final_equity = result["equityCurve"][-1]["equity"]
        expected_return = ((final_equity - 100_000) / 100_000) * 100
        assert result["metrics"]["totalReturn"] == pytest.approx(expected_return, abs=0.01)

    def test_max_drawdown_is_non_positive(self):
        data = _crossover_market()
        engine = SimulationEngine(data, 100_000, {
            "strategyType": "MOVING_AVERAGE_CROSSOVER",
            "params": {"shortPeriod": 20, "longPeriod": 50, "initialCapital": 100_000},
        })
        result = engine.run()
        assert result["metrics"]["maxDrawdown"] <= 0

    def test_cost_breakdown_sums_to_total(self):
        data = _crossover_market()
        engine = SimulationEngine(data, 100_000, {
            "strategyType": "MOVING_AVERAGE_CROSSOVER",
            "params": {"shortPeriod": 20, "longPeriod": 50, "initialCapital": 100_000},
        })
        result = engine.run()
        cb = result["costBreakdown"]
        component_sum = cb["stt"] + cb["brokerage"] + cb["slippage"] + cb["exchangeFees"] + cb["gst"] + cb["stampDuty"]
        # _js_round2 applied to each component individually causes rounding drift
        assert cb["totalCosts"] == pytest.approx(component_sum, abs=1.0)


# ── Edge Cases ───────────────────────────────────────────────────────────────

class TestEdgeCases:
    def test_insufficient_data_no_trades(self):
        """Too few candles for indicators → no signals fire → zero trades."""
        data = _rising_market(30)  # Only 30 candles, longPeriod=50
        engine = SimulationEngine(data, 100_000, {
            "strategyType": "MOVING_AVERAGE_CROSSOVER",
            "params": {"shortPeriod": 20, "longPeriod": 50, "initialCapital": 100_000},
        })
        result = engine.run()
        # With only 30 candles but longPeriod=50, SMA can't be computed → no trades
        assert result["metrics"]["totalTrades"] == 0

    def test_zero_capital_raises(self):
        """Zero initial capital should raise ValueError."""
        data = _rising_market(300)
        with pytest.raises(ValueError, match="Initial capital must be positive"):
            SimulationEngine(data, 0, {
                "strategyType": "MOVING_AVERAGE_CROSSOVER",
                "params": {"shortPeriod": 20, "longPeriod": 50, "initialCapital": 0},
            })

    def test_empty_data_raises(self):
        """Empty market data should raise ValueError."""
        with pytest.raises(ValueError, match="non-empty"):
            SimulationEngine([], 100_000, {
                "strategyType": "MOVING_AVERAGE_CROSSOVER",
                "params": {"shortPeriod": 20, "longPeriod": 50, "initialCapital": 100_000},
            })

    def test_seeded_run_is_deterministic(self):
        """Same seed → identical results."""
        data = _crossover_market()
        config = {
            "strategyType": "MOVING_AVERAGE_CROSSOVER",
            "params": {"shortPeriod": 20, "longPeriod": 50, "initialCapital": 100_000, "seed": 42},
        }

        result1 = SimulationEngine(data, 100_000, config).run()
        result2 = SimulationEngine(data, 100_000, config).run()

        assert result1["metrics"]["totalReturn"] == result2["metrics"]["totalReturn"]
        assert result1["metrics"]["sharpeRatio"] == result2["metrics"]["sharpeRatio"]
        assert len(result1["trades"]) == len(result2["trades"])
        for t1, t2 in zip(result1["trades"], result2["trades"]):
            assert t1["profitLoss"] == t2["profitLoss"]


# ── Risk Model: position sizing + stop-loss ──────────────────────────────────

class TestRiskModel:
    """Fixed-fractional position sizing and stop-loss exits."""

    _MA_CONFIG = {
        "strategyType": "MOVING_AVERAGE_CROSSOVER",
        "params": {"shortPeriod": 20, "longPeriod": 50, "initialCapital": 100_000},
    }

    def _risk_config(self, risk_pct=0.02, stop_pct=0.05):
        return {
            "strategyType": "MOVING_AVERAGE_CROSSOVER",
            "params": {
                "shortPeriod": 20, "longPeriod": 50, "initialCapital": 100_000,
                "riskPct": risk_pct, "stopLossPct": stop_pct,
            },
        }

    def test_target_shares_sizes_to_risk(self):
        """position_value = (risk * equity) / stop → fewer shares than all-in."""
        data = _rising_market(300)
        risk_eng = SimulationEngine(data, 100_000, self._risk_config())
        legacy_eng = SimulationEngine(data, 100_000, self._MA_CONFIG)

        # risk 2% / stop 5% → deploy ~40% of equity → 40_000 / 100 = 400 shares
        assert risk_eng._target_shares(100.0) == 400
        # legacy deploys (almost) all cash → far more shares
        assert legacy_eng._target_shares(100.0) > risk_eng._target_shares(100.0)

    def test_risk_managed_run_does_not_go_all_in(self):
        """First entry deploys a fraction of capital, not the whole book."""
        data = _crossover_market()
        result = SimulationEngine(data, 100_000, self._risk_config()).run()
        assert result["trades"], "expected at least one trade"
        first = result["trades"][0]
        deployed = first["shares"] * first["entryPrice"]
        # 2% risk / 5% stop ⇒ ~40% deployed; comfortably under all-in.
        assert deployed < 0.6 * 100_000

    def test_stop_loss_fires_on_crash(self):
        """A violent drop after entry should trigger a stop exit, not a signal."""
        data = _crash_market()  # V-shape then craters -12%/bar
        config = {
            "strategyType": "MOVING_AVERAGE_CROSSOVER",
            "params": {
                "shortPeriod": 5, "longPeriod": 20, "initialCapital": 100_000,
                "riskPct": 0.02, "stopLossPct": 0.05,
            },
        }
        result = SimulationEngine(data, 100_000, config).run()
        reasons = [t["exitReason"] for t in result["trades"]]
        assert "stop" in reasons

    def test_every_trade_has_exit_reason(self):
        data = _crossover_market()
        result = SimulationEngine(data, 100_000, self._risk_config()).run()
        for t in result["trades"]:
            assert t["exitReason"] in ("signal", "stop", "force_close")

    def test_legacy_run_has_no_stop_exits(self):
        """Without risk params, no stop should ever fire."""
        data = _crossover_market()
        result = SimulationEngine(data, 100_000, self._MA_CONFIG).run()
        assert all(t["exitReason"] != "stop" for t in result["trades"])
