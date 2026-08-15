"""
Tests for engine/metrics.py — Vectorized Risk Metrics
=====================================================
These tests use known, hand-calculated inputs to verify
that Sharpe, CAGR, Max Drawdown, Alpha, and Information Ratio
produce mathematically correct values.
"""

import numpy as np
import pytest

import engine.metrics as md

from engine.metrics import (
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
        ir = information_ratio(equity, equity)
        assert ir == 0.0

    def test_single_point_returns_zero(self):
        equity = np.array([100_000.0])
        prices = np.array([1000.0])
        assert information_ratio(equity, prices) == 0.0


# ── Sortino / downside deviation (STAT-01) ───────────────────────────────────

class TestSortinoAndDownsideDeviation:
    """
    Regression guard for STAT-01. The client used to compute Sortino as
    stdev(negative returns about their own mean) with Rf = 0, which both
    divides by the wrong N and drops the target — it can rank a losing
    strategy above its own Sharpe.
    """

    @staticmethod
    def _curve_from_returns(rets, start=100_000.0):
        eq = [start]
        for r in rets:
            eq.append(eq[-1] * (1 + r))
        return np.array(eq, dtype=np.float64)

    def test_downside_deviation_divides_by_all_periods(self):
        # 4 periods, only one below target -> mean of squares over N=4, not 1.
        rets = [0.02, 0.02, -0.03, 0.02]
        eq = self._curve_from_returns(rets)

        actual = md.downside_deviation(eq, target=0.0)
        realised = md.daily_returns(eq)
        shortfall = np.minimum(realised - 0.0, 0.0)
        expected = float(np.sqrt(np.mean(shortfall ** 2)) * np.sqrt(md.TRADING_DAYS))

        assert actual == pytest.approx(expected, rel=1e-12)
        # Dividing by the count of losers only would be ~2x larger.
        wrong = float(np.sqrt(np.sum(shortfall ** 2) / 1) * np.sqrt(md.TRADING_DAYS))
        assert actual < wrong

    def test_no_losing_period_gives_zero_downside_deviation(self):
        eq = self._curve_from_returns([0.01] * 20)
        assert md.downside_deviation(eq, target=0.0) == 0.0

    def test_sortino_uses_the_same_risk_free_rate_as_sharpe(self):
        """
        Both ratios share a numerator: annualized excess return. Their ratio
        must therefore equal the inverse ratio of their denominators.
        """
        rng = np.random.default_rng(3)
        eq = self._curve_from_returns(rng.normal(0.0004, 0.01, 400))

        sharpe = md.sharpe_ratio(eq)
        sortino = md.sortino_ratio(eq)
        ann_vol = md.annualized_volatility(eq) / 100
        dd = md.downside_deviation(eq)

        assert sharpe == pytest.approx(sortino * dd / ann_vol, rel=1e-9)

    def test_sortino_exceeds_sharpe_when_downside_is_thin(self):
        """Upside-skewed series: downside deviation < total vol -> Sortino > Sharpe."""
        rets = [0.05, 0.05, 0.05, -0.005, 0.05, -0.005] * 20
        eq = self._curve_from_returns(rets)
        assert md.sortino_ratio(eq) > md.sharpe_ratio(eq) > 0

    def test_short_curve_is_zero_not_nan(self):
        for fn in (md.sortino_ratio, md.downside_deviation,
                   md.annualized_volatility, md.value_at_risk):
            assert fn(np.array([100_000.0])) == 0.0


class TestRollingSharpe:
    def test_window_shorter_than_data_is_empty(self):
        assert md.rolling_sharpe(np.linspace(100_000, 110_000, 30), window=60) == []

    def test_last_value_matches_full_sharpe_of_that_window(self):
        rng = np.random.default_rng(11)
        eq = np.cumprod(np.concatenate([[100_000.0], 1 + rng.normal(0.0005, 0.01, 200)]))
        window = 60
        roll = md.rolling_sharpe(eq, window=window)
        assert len(roll) == len(md.daily_returns(eq)) - window + 1
        # Recomputing the standalone Sharpe over the final window's equity
        # segment must agree with the last rolling value.
        assert md.sharpe_ratio(eq[-(window + 1):]) == pytest.approx(roll[-1], rel=1e-9)


class TestJensensAlpha:
    def test_beta_one_and_zero_alpha_when_strategy_equals_benchmark(self):
        rng = np.random.default_rng(5)
        prices = np.cumprod(np.concatenate([[1000.0], 1 + rng.normal(0.0004, 0.012, 300)]))
        out = md.jensens_alpha(prices, prices)
        assert out["beta"] == pytest.approx(1.0, abs=1e-9)
        assert out["alpha"] == pytest.approx(0.0, abs=1e-9)
        assert out["rSquared"] == pytest.approx(1.0, abs=1e-9)

    def test_half_exposure_gives_beta_near_half(self):
        rng = np.random.default_rng(9)
        bench_rets = rng.normal(0.0005, 0.012, 400)
        prices = np.cumprod(np.concatenate([[1000.0], 1 + bench_rets]))
        equity = np.cumprod(np.concatenate([[100_000.0], 1 + 0.5 * bench_rets]))
        out = md.jensens_alpha(equity, prices)
        assert out["beta"] == pytest.approx(0.5, abs=0.02)

    def test_degenerate_input_returns_zeros(self):
        out = md.jensens_alpha(np.array([1.0, 2.0]), np.array([1.0]))
        assert out == {"alpha": 0.0, "beta": 0.0, "rSquared": 0.0}


class TestExcessCagrNaming:
    def test_alpha_is_a_deprecated_mirror_of_excess_cagr(self):
        assert md.alpha is md.excess_cagr
        assert md.excess_cagr(25.0, 15.0) == 10.0
