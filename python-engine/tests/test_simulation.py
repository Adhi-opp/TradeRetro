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
    l = low or close
    return {"date": date, "open": o, "high": h, "low": l, "close": close, "volume": 100_000}


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
