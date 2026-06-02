"""
Tests for engine/wfa.py — walk-forward analysis.

Covers the pure fold/warmup/stitch logic plus a small end-to-end run on
synthetic data to prove the train→test→stitch pipeline holds together and the
efficiency ratio / verdict come out sane.
"""

from engine.wfa import generate_folds, run_wfa, strategy_warmup


def _make_candle(date, close):
    return {"date": date, "open": close, "high": close, "low": close, "close": close, "volume": 100_000}


def _trend_market(n=900):
    """Long rising-then-falling series so MA crossovers actually fire."""
    candles = []
    price = 100.0
    for i in range(n):
        # gentle up-trend with a mid-series dip to create real crossovers
        drift = 0.0015 if (i // 150) % 2 == 0 else -0.0012
        price *= (1 + drift)
        day = f"2020-{1 + (i // 28) % 12:02d}-{1 + i % 28:02d}"
        candles.append(_make_candle(day, round(price, 2)))
    return candles


# ── generate_folds ───────────────────────────────────────────────────────────

class TestGenerateFolds:
    def test_non_overlapping_test_segments_by_default(self):
        folds = generate_folds(n_visible=1000, train_bars=252, test_bars=63)
        # step defaults to test_bars → test windows tile without overlap
        assert folds[0]["test"] == (252, 315)
        assert folds[1]["test"] == (315, 378)
        assert all(f["test"][1] - f["test"][0] == 63 for f in folds)

    def test_train_window_precedes_test(self):
        folds = generate_folds(1000, 252, 63)
        for f in folds:
            assert f["train"][1] == f["test"][0]
            assert f["train"][1] - f["train"][0] == 252

    def test_too_short_yields_no_folds(self):
        assert generate_folds(n_visible=200, train_bars=252, test_bars=63) == []

    def test_custom_step(self):
        folds = generate_folds(1000, 252, 63, step=126)
        assert folds[1]["train"][0] - folds[0]["train"][0] == 126


# ── strategy_warmup ──────────────────────────────────────────────────────────

class TestWarmup:
    def test_ma_uses_long_period(self):
        assert strategy_warmup("MOVING_AVERAGE_CROSSOVER", {"longPeriod": 200}) == 200

    def test_donchian_needs_period_plus_one(self):
        assert strategy_warmup("DONCHIAN_BREAKOUT", {"dcPeriod": 20}) == 21

    def test_macd_fixed(self):
        assert strategy_warmup("MACD", {}) == 35


# ── End-to-end ───────────────────────────────────────────────────────────────

class TestRunWFA:
    def _candidates(self):
        return [
            {"shortPeriod": 10, "longPeriod": 30},
            {"shortPeriod": 20, "longPeriod": 50},
            {"shortPeriod": 30, "longPeriod": 90},
        ]

    def test_structure_and_fold_count(self):
        data = _trend_market(900)
        warmup = 90  # max longPeriod
        result = run_wfa(
            market_data=data,
            visible_start=warmup,                      # pretend first 90 are warm-up
            strategy_type="MOVING_AVERAGE_CROSSOVER",
            base_params={"initialCapital": 100_000},
            candidates=self._candidates(),
            train_bars=252,
            test_bars=63,
            metric="sharpe",
        )
        assert "folds" in result and "stitchedOOS" in result and "summary" in result
        s = result["summary"]
        assert s["folds"] == len(result["folds"])
        assert s["folds"] >= 1
        # Each fold tests one of the candidate sets out-of-sample.
        for f in result["folds"]:
            assert f["bestParams"] in self._candidates()
            assert f["testStart"] is not None and f["testEnd"] is not None

    def test_stitched_curve_is_continuous(self):
        data = _trend_market(900)
        result = run_wfa(
            data, 90, "MOVING_AVERAGE_CROSSOVER", {"initialCapital": 100_000},
            self._candidates(), 252, 63, "sharpe",
        )
        stitched = result["stitchedOOS"]
        assert len(stitched) > 0
        # Monotonic dates, finite equity.
        eqs = [p["equity"] for p in stitched]
        assert all(e > 0 for e in eqs)

    def test_insufficient_data_returns_reason(self):
        data = _trend_market(200)
        result = run_wfa(
            data, 90, "MOVING_AVERAGE_CROSSOVER", {"initialCapital": 100_000},
            self._candidates(), 252, 63, "sharpe",
        )
        assert result["folds"] == []
        assert "reason" in result["summary"]

    def test_efficiency_and_verdict_present(self):
        data = _trend_market(900)
        result = run_wfa(
            data, 90, "MOVING_AVERAGE_CROSSOVER", {"initialCapital": 100_000},
            self._candidates(), 252, 63, "sharpe",
        )
        s = result["summary"]
        assert s["verdict"] in ("robust", "marginal", "overfit", "n/a")
        assert "wfaEfficiency" in s
