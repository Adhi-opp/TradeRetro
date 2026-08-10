"""
Tests for engine/indicators.py — index alignment
=================================================
Every indicator returns a series that the engine indexes by bar number via a
fixed offset. If a series is off by one, the strategy silently reads an
indicator computed from a bar it could not have seen yet — look-ahead bias
that no end-to-end test catches, because the backtest still "works".

These tests pin the contract: for each indicator, element `j` corresponds to
bar `j + offset`, and the offset is exactly what engine/simulation.py uses.
"""

import numpy as np
import pytest

from engine.indicators import (
    compute_rsi, compute_sma, compute_macd,
    compute_bollinger_bands, compute_donchian_channel,
)


def _series(n=80, seed=7):
    rng = np.random.default_rng(seed)
    return np.cumsum(rng.normal(0, 1, n)) + 100.0


def _wilder_rsi_reference(close, period):
    """
    Textbook Wilder RSI, written independently of the implementation.
    Returns {bar_index: rsi_value}, so alignment is asserted against bar
    numbers rather than against another array's indexing.
    """
    deltas = np.diff(close)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    avg_gain = gains[:period].mean()
    avg_loss = losses[:period].mean()

    def rsi(g, l_):
        return 100.0 if l_ == 0 else 100.0 - 100.0 / (1.0 + g / l_)

    # The seeded average uses deltas[0..period-1], i.e. closes[0..period] —
    # so it is the RSI OF BAR `period`.
    out = {period: rsi(avg_gain, avg_loss)}
    for i in range(period, len(deltas)):
        avg_gain = avg_gain * (period - 1) / period + gains[i] / period
        avg_loss = avg_loss * (period - 1) / period + losses[i] / period
        out[i + 1] = rsi(avg_gain, avg_loss)   # deltas[i] ends at bar i+1
    return out


# ── RSI ──────────────────────────────────────────────────────────────────────

class TestRSIAlignment:
    """Regression guard for ENG-01 (RSI was shifted +1 bar into the future)."""

    @pytest.mark.parametrize("period", [2, 5, 14, 21, 30])
    def test_length_is_n_minus_period(self, period):
        close = _series(120)
        assert len(compute_rsi(close, period)) == len(close) - period

    def test_element_j_is_the_rsi_of_bar_j_plus_period(self):
        period = 14
        close = _series(120)
        got = compute_rsi(close, period)
        ref = _wilder_rsi_reference(close, period)

        for j, value in enumerate(got):
            bar = j + period
            assert bar in ref, f"element {j} maps to bar {bar}, outside reference"
            assert value == pytest.approx(ref[bar], rel=1e-9), (
                f"element {j} should be the RSI of bar {bar}"
            )

    def test_first_element_is_the_seeded_average_not_the_smoothed_one(self):
        """
        The specific ENG-01 failure: dropping the seed made element 0 equal
        the reference's *second* value. Assert it equals the first.
        """
        period = 14
        close = _series(60)
        ref = _wilder_rsi_reference(close, period)
        first = compute_rsi(close, period)[0]

        assert first == pytest.approx(ref[period], rel=1e-12)
        assert first != pytest.approx(ref[period + 1], rel=1e-12)

    def test_rsi_stays_in_bounds(self):
        rsi = compute_rsi(_series(200), 14)
        assert rsi.min() >= 0.0 and rsi.max() <= 100.0

    def test_monotonic_rise_pins_at_100(self):
        close = np.arange(1.0, 60.0)
        assert compute_rsi(close, 14) == pytest.approx(100.0)

    def test_returns_empty_when_history_too_short(self):
        assert len(compute_rsi(np.array([1.0, 2.0, 3.0]), 14)) == 0
        assert len(compute_rsi(np.arange(15.0), 14)) == 1


# ── The other four, so the same class of bug can't reappear ─────────────────

class TestOtherIndicatorAlignment:

    def test_sma_element_j_is_bar_j_plus_period_minus_1(self):
        period, close = 20, _series(100)
        sma = compute_sma(close, period)
        assert len(sma) == len(close) - period + 1
        for j in (0, 5, len(sma) - 1):
            bar = j + period - 1
            assert sma[j] == pytest.approx(close[bar - period + 1: bar + 1].mean())

    def test_macd_offset_matches_engine_assumption(self):
        close = _series(100)
        macd = compute_macd(close)
        # simulation.py derives macdOffset = len(close) - len(macd)
        assert len(close) - len(macd) == 25          # slow_period - 1
        assert set(macd[0]) == {"MACD", "signal", "histogram"}

    def test_bollinger_element_j_is_bar_j_plus_period_minus_1(self):
        period, close = 20, _series(100)
        bb = compute_bollinger_bands(close, period, 2.0)
        assert len(bb) == len(close) - period + 1
        for j in (0, 10, len(bb) - 1):
            assert bb[j]["close"] == pytest.approx(close[j + period - 1])
            assert bb[j]["lower"] <= bb[j]["middle"] <= bb[j]["upper"]

    def test_donchian_is_full_length_and_excludes_current_bar(self):
        period = 20
        close = _series(100)
        high = close + 1.0
        low = close - 1.0
        dc = compute_donchian_channel(high, low, period)

        assert len(dc) == len(close)                  # indexed by bar directly
        assert all(dc[i]["highest_high"] is None for i in range(period))

        bar = 50
        assert dc[bar]["highest_high"] == pytest.approx(high[bar - period: bar].max())
        assert dc[bar]["lowest_low"] == pytest.approx(low[bar - period: bar].min())

    def test_donchian_channel_can_actually_be_broken(self):
        """A close must be able to exceed its own channel, or breakout never fires."""
        close = np.arange(1.0, 80.0)
        dc = compute_donchian_channel(close, close, 20)
        assert any(
            dc[i]["highest_high"] is not None and close[i] > dc[i]["highest_high"]
            for i in range(len(close))
        )
