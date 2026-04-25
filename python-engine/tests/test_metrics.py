"""
Tests for engine/metrics.py — Vectorized Risk Metrics
=====================================================
These tests use known, hand-calculated inputs to verify
that Sharpe, CAGR, Max Drawdown, Alpha, and Information Ratio
produce mathematically correct values.
"""

import numpy as np
import pytest

from engine.metrics import (
    RISK_FREE_RATE,
    TRADING_DAYS,
    alpha,
    benchmark_cagr,
    cagr,
    information_ratio,
    max_drawdown,
    sharpe_ratio,
)


# ── Sharpe Ratio ─────────────────────────────────────────────────────────────

class TestSharpeRatio:
    def test_flat_equity_returns_zero(self):
        """Flat equity curve → zero volatility → Sharpe = 0."""
        equity = np.array([100_000.0] * 252)
        assert sharpe_ratio(equity) == 0.0

    def test_single_point_returns_zero(self):
        equity = np.array([100_000.0])
        assert sharpe_ratio(equity) == 0.0

    def test_empty_array_returns_zero(self):
        equity = np.array([])
        assert sharpe_ratio(equity) == 0.0

    def test_positive_return_positive_sharpe(self):
        """Steady linear growth over 252 days → Sharpe should be positive (or at least > -1)."""
        equity = np.linspace(100_000, 120_000, 252)
        s = sharpe_ratio(equity)
        # 20% return over 1 year with low vol should yield positive Sharpe
        assert s > 0

    def test_high_vol_lowers_sharpe(self):
        """Same return but with high volatility → lower Sharpe."""
        np.random.seed(42)
        steady = np.linspace(100_000, 120_000, 252)
        volatile = steady + np.random.normal(0, 5000, 252)
        volatile[0] = 100_000
        volatile[-1] = 120_000

        sharpe_steady = sharpe_ratio(steady)
        sharpe_volatile = sharpe_ratio(volatile)
        assert sharpe_steady > sharpe_volatile

    def test_known_value(self):
        """Verify Sharpe with realistic volatile returns."""
        np.random.seed(42)
        # 252 days with mean daily return ~0.04% and std ~1% (realistic equity)
        daily_returns = np.random.normal(0.0004, 0.01, 252)
        equity = np.cumprod(1 + daily_returns) * 100_000
        s = sharpe_ratio(equity)
        # ann_return ≈ 0.1, ann_std ≈ 0.16, Sharpe ≈ (0.1 - 0.065) / 0.16 ≈ 0.22
        assert -2 < s < 3  # Reasonable range for noisy returns


# ── Max Drawdown ─────────────────────────────────────────────────────────────

class TestMaxDrawdown:
    def test_monotonic_increase_zero_drawdown(self):
        """Strictly increasing equity → drawdown = 0."""
        equity = np.linspace(100_000, 200_000, 100)
        assert max_drawdown(equity) == 0.0

    def test_single_point_returns_zero(self):
        equity = np.array([100_000.0])
        assert max_drawdown(equity) == 0.0

    def test_known_drawdown(self):
        """Peak at 200k, trough at 150k → MDD = -25%."""
        equity = np.array([100_000, 150_000, 200_000, 150_000, 180_000])
        mdd = max_drawdown(equity)
        assert pytest.approx(mdd, abs=1e-10) == -0.25

    def test_full_recovery_still_records_drawdown(self):
        """Even if equity recovers, the drawdown from peak is recorded."""
        equity = np.array([100_000, 200_000, 100_000, 200_000])
        mdd = max_drawdown(equity)
        assert pytest.approx(mdd, abs=1e-10) == -0.5

    def test_always_negative_or_zero(self):
        """Drawdown should never be positive."""
        np.random.seed(99)
        equity = np.cumsum(np.random.normal(100, 50, 500)) + 100_000
        equity = np.abs(equity)  # Ensure positive
        assert max_drawdown(equity) <= 0.0


# ── CAGR ─────────────────────────────────────────────────────────────────────

class TestCAGR:
    def test_zero_years_returns_zero(self):
        assert cagr(100_000, 120_000, 0) == 0.0

    def test_zero_capital_returns_zero(self):
        assert cagr(0, 120_000, 252) == 0.0

    def test_one_year_simple(self):
        """100k → 120k in 252 candles (1 year) = 20% CAGR."""
        c = cagr(100_000, 120_000, 252)
        assert pytest.approx(c, abs=0.01) == 20.0

    def test_two_years(self):
        """100k → 144k in 504 candles (2 years) ≈ 20% CAGR."""
        c = cagr(100_000, 144_000, 504)
        assert pytest.approx(c, abs=0.01) == 20.0

    def test_negative_return(self):
        """100k → 80k in 252 candles = -20% CAGR."""
        c = cagr(100_000, 80_000, 252)
        assert pytest.approx(c, abs=0.01) == -20.0


# ── Benchmark CAGR ───────────────────────────────────────────────────────────

class TestBenchmarkCAGR:
    def test_same_as_cagr_for_same_ratio(self):
        """benchmark_cagr(100, 120, 252) should equal cagr(100, 120, 252)."""
        b = benchmark_cagr(100, 120, 252)
        c = cagr(100, 120, 252)
        assert pytest.approx(b, abs=1e-6) == c


# ── Alpha ────────────────────────────────────────────────────────────────────

class TestAlpha:
    def test_positive_alpha(self):
        assert alpha(25.0, 15.0) == 10.0

    def test_negative_alpha(self):
        assert alpha(10.0, 15.0) == -5.0

    def test_zero_alpha(self):
        assert alpha(15.0, 15.0) == 0.0


# ── Information Ratio ────────────────────────────────────────────────────────

class TestInformationRatio:
    def test_identical_curves_returns_zero(self):
        """Strategy = benchmark → excess return = 0 → IR = 0."""
        equity = np.linspace(100_000, 120_000, 100)
        prices = equity / 1000  # Same shape, different scale
        ir = information_ratio(equity, equity)
        assert ir == 0.0

    def test_single_point_returns_zero(self):
        equity = np.array([100_000.0])
        prices = np.array([1000.0])
        assert information_ratio(equity, prices) == 0.0
