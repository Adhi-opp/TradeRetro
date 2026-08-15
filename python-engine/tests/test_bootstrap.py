"""
Tests for engine/bootstrap.py — stationary block bootstrap.

The point of this module is to say whether a Sharpe is distinguishable from
noise, so the tests are built around cases where the right answer is known:
a strong signal must come back significant, pure noise must not, and the
resampling itself must preserve the properties the method depends on.
"""

import numpy as np

from engine.metrics import DAILY_RISK_FREE
from engine.bootstrap import (
    confidence_interval,
    significance_report,
    stationary_bootstrap_indices,
    bootstrap_distribution,
)


def _curve(returns, start=100_000.0):
    eq = [start]
    for r in returns:
        eq.append(eq[-1] * (1 + r))
    return np.array(eq, dtype=np.float64)


class TestResampling:
    def test_index_path_has_the_right_length_and_range(self):
        rng = np.random.default_rng(0)
        idx = stationary_bootstrap_indices(500, 10, rng)
        assert len(idx) == 500
        assert idx.min() >= 0 and idx.max() < 500

    def test_blocks_are_contiguous_on_average(self):
        """
        With mean block 20, consecutive-index steps should dominate. An i.i.d.
        resample would show almost none, which is exactly the dependence this
        method exists to preserve.
        """
        rng = np.random.default_rng(1)
        idx = stationary_bootstrap_indices(2000, 20, rng)
        steps = (np.diff(idx) % 2000) == 1
        assert steps.mean() > 0.85

    def test_shorter_mean_block_breaks_more_often(self):
        rng = np.random.default_rng(2)
        short = stationary_bootstrap_indices(2000, 2, rng)
        long_ = stationary_bootstrap_indices(2000, 50, rng)
        short_contig = ((np.diff(short) % 2000) == 1).mean()
        long_contig = ((np.diff(long_) % 2000) == 1).mean()
        assert short_contig < long_contig

    def test_wraps_circularly_so_every_observation_is_reachable(self):
        rng = np.random.default_rng(3)
        seen = set()
        for _ in range(40):
            seen.update(stationary_bootstrap_indices(50, 5, rng).tolist())
        assert len(seen) == 50

    def test_distribution_is_deterministic_for_a_seed(self):
        rets = np.random.default_rng(4).normal(0.0005, 0.01, 400)
        a = bootstrap_distribution(rets, "sharpe", resamples=200, seed=7)
        b = bootstrap_distribution(rets, "sharpe", resamples=200, seed=7)
        c = bootstrap_distribution(rets, "sharpe", resamples=200, seed=8)
        assert np.array_equal(a, b)
        assert not np.array_equal(a, c)


class TestConfidenceIntervals:
    def test_interval_brackets_the_point_estimate(self):
        rets = np.random.default_rng(5).normal(0.0006, 0.011, 800)
        r = confidence_interval(_curve(rets), "sharpe", resamples=400)
        assert r["ciLow"] <= r["point"] <= r["ciHigh"]

    def test_no_edge_is_not_significant(self):
        """
        The null for a Sharpe ratio is "earns exactly the risk-free rate",
        not "earns nothing" — Sharpe subtracts Rf, so a 0%-drift series has a
        genuinely negative Sharpe and enough data will prove it. Drift set to
        DAILY_RISK_FREE is the real no-edge case, and its CI must span zero.
        """
        rets = np.random.default_rng(6).normal(DAILY_RISK_FREE, 0.012, 1000)
        r = confidence_interval(_curve(rets), "sharpe", resamples=500)
        assert r["ciLow"] < 0 < r["ciHigh"]
        assert r["significant"] is False
        assert r["pValue"] > 0.05

    def test_a_mediocre_sharpe_is_unprovable_at_realistic_sample_sizes(self):
        """
        The headline reason this module exists. Four years of daily data on a
        strategy with a point-estimate Sharpe near -0.9 still yields an
        interval that straddles zero: annualized Sharpe error scales with
        1/sqrt(years), so ~4 years buys a standard error around 0.5. Any
        claim about a Sharpe of this magnitude from this much data is noise,
        in either direction.
        """
        rets = np.random.default_rng(6).normal(0.0, 0.006, 1000)
        r = confidence_interval(_curve(rets), "sharpe", resamples=500)

        assert r["point"] < -0.5, "expected a clearly negative point estimate"
        assert r["ciLow"] < 0 < r["ciHigh"], "expected the interval to straddle zero"
        assert r["significant"] is False
        assert (r["ciHigh"] - r["ciLow"]) > 1.0, "expected a wide interval"

    def test_strong_persistent_edge_is_significant(self):
        """Large drift relative to volatility: the CI must exclude zero."""
        rng = np.random.default_rng(7)
        rets = rng.normal(0.004, 0.004, 1000)
        r = confidence_interval(_curve(rets), "sharpe", resamples=500)
        assert r["ciLow"] > 0
        assert r["significant"] is True
        assert r["pValue"] < 0.05

    def test_wider_interval_on_less_data(self):
        rng = np.random.default_rng(8)
        long_rets = rng.normal(0.0005, 0.01, 1500)
        short_rets = long_rets[:150]
        wide = confidence_interval(_curve(short_rets), "sharpe", resamples=400)
        tight = confidence_interval(_curve(long_rets), "sharpe", resamples=400)
        assert (wide["ciHigh"] - wide["ciLow"]) > (tight["ciHigh"] - tight["ciLow"])

    def test_cagr_statistic_is_supported(self):
        rets = np.random.default_rng(9).normal(0.0007, 0.01, 600)
        r = confidence_interval(_curve(rets), "cagr", resamples=300)
        assert r["point"] is not None
        assert r["ciLow"] <= r["point"] <= r["ciHigh"]

    def test_degenerate_input_returns_nulls_not_nan(self):
        r = confidence_interval(np.array([100_000.0, 100_100.0]), "sharpe")
        assert r["point"] is None and r["significant"] is False


class TestSignificanceReport:
    def test_reports_both_statistics_and_a_verdict(self):
        # Drift == daily Rf is the true no-edge null (see the note above).
        rets = np.random.default_rng(11).normal(DAILY_RISK_FREE, 0.012, 800)
        rep = significance_report(_curve(rets), resamples=300)
        assert set(rep["results"]) == {"sharpe", "cagr"}
        assert rep["verdict"] == "not_distinguishable_from_zero"
        assert "contains zero" in rep["reason"]

    def test_verdict_flags_a_genuine_edge(self):
        rets = np.random.default_rng(11).normal(0.004, 0.004, 800)
        rep = significance_report(_curve(rets), resamples=300)
        assert rep["verdict"] == "significant_positive"

    def test_verdict_flags_a_genuinely_bad_strategy(self):
        rets = np.random.default_rng(12).normal(-0.004, 0.004, 800)
        rep = significance_report(_curve(rets), resamples=300)
        assert rep["verdict"] == "significant_negative"

    def test_method_metadata_is_reported_for_the_writeup(self):
        rets = np.random.default_rng(13).normal(0.0005, 0.01, 400)
        rep = significance_report(_curve(rets), resamples=250, mean_block=15)
        assert rep["resamples"] == 250
        assert rep["meanBlockDays"] == 15
        assert rep["confidence"] == 0.95
        assert "Politis" in rep["method"]


class TestIidComparison:
    def test_iid_resampling_would_understate_the_interval(self):
        """
        Justifies the choice of method: on a serially-correlated series, a
        mean_block of 1 (i.e. i.i.d.) produces a visibly narrower interval
        than a block bootstrap that preserves the dependence.
        """
        rng = np.random.default_rng(14)
        # AR(1) returns — volatility and drift persist across days.
        n, phi = 1200, 0.35
        eps = rng.normal(0, 0.01, n)
        rets = np.empty(n)
        rets[0] = eps[0]
        for i in range(1, n):
            rets[i] = phi * rets[i - 1] + eps[i]
        curve = _curve(rets)

        iid = confidence_interval(curve, "sharpe", resamples=500, mean_block=1)
        block = confidence_interval(curve, "sharpe", resamples=500, mean_block=20)

        assert (block["ciHigh"] - block["ciLow"]) > (iid["ciHigh"] - iid["ciLow"])
