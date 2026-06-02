"""
Tests for pipeline/reconciliation.py — the pure gap-detection logic.

These run without a DB or a live feed: they prove the detector correctly
identifies missing 1-minute buckets and groups them into contiguous windows,
which is the heart of the self-healing pipeline.
"""

from datetime import datetime, time, timedelta

from pipeline.market_hours import IST
from pipeline.reconciliation import (
    GRACE_MINUTES, find_gaps, minute_grid, session_bounds,
)


def _ist(y, mo, d, h, mi):
    return datetime(y, mo, d, h, mi, tzinfo=IST)


# ── minute_grid ──────────────────────────────────────────────────────────────

class TestMinuteGrid:
    def test_grid_count_and_alignment(self):
        start = _ist(2026, 5, 29, 9, 15)
        end = _ist(2026, 5, 29, 9, 25)
        grid = minute_grid(start, end)
        assert len(grid) == 10                 # [9:15 .. 9:24], end exclusive
        assert grid[0] == start
        assert grid[-1] == _ist(2026, 5, 29, 9, 24)
        assert all((grid[i + 1] - grid[i]) == timedelta(minutes=1) for i in range(len(grid) - 1))

    def test_seconds_are_floored(self):
        start = _ist(2026, 5, 29, 9, 15).replace(second=37)
        grid = minute_grid(start, _ist(2026, 5, 29, 9, 18))
        assert grid[0].second == 0
        assert len(grid) == 3

    def test_empty_when_end_before_start(self):
        assert minute_grid(_ist(2026, 5, 29, 10, 0), _ist(2026, 5, 29, 9, 0)) == []


# ── find_gaps ────────────────────────────────────────────────────────────────

class TestFindGaps:
    def _expected(self, n=10):
        start = _ist(2026, 5, 29, 9, 15)
        return minute_grid(start, start + timedelta(minutes=n))

    def test_no_gaps_when_all_present(self):
        exp = self._expected(10)
        assert find_gaps(set(exp), exp) == []

    def test_single_contiguous_gap(self):
        exp = self._expected(10)
        present = set(exp) - {exp[3], exp[4], exp[5]}
        gaps = find_gaps(present, exp)
        assert len(gaps) == 1
        assert gaps[0]["from"] == exp[3]
        assert gaps[0]["to"] == exp[5]
        assert gaps[0]["minutes"] == 3

    def test_two_separate_gaps(self):
        exp = self._expected(10)
        present = set(exp) - {exp[2], exp[6], exp[7]}
        gaps = find_gaps(present, exp)
        assert len(gaps) == 2
        assert gaps[0]["minutes"] == 1 and gaps[0]["from"] == exp[2]
        assert gaps[1]["minutes"] == 2 and gaps[1]["from"] == exp[6]

    def test_gap_at_the_end(self):
        exp = self._expected(10)
        present = set(exp[:-2])              # last two missing
        gaps = find_gaps(present, exp)
        assert len(gaps) == 1
        assert gaps[0]["to"] == exp[-1]
        assert gaps[0]["minutes"] == 2

    def test_everything_missing_is_one_window(self):
        exp = self._expected(5)
        gaps = find_gaps(set(), exp)
        assert len(gaps) == 1
        assert gaps[0]["minutes"] == 5


# ── session_bounds ───────────────────────────────────────────────────────────

class TestSessionBounds:
    def test_full_session_without_cutoff(self):
        start, end = session_bounds(datetime(2026, 5, 29).date())
        assert start.time() == time(9, 15)
        assert end.time() == time(15, 30)

    def test_cutoff_applies_grace(self):
        # Mid-session at 10:30:45 → end clipped to 10:30 minus the grace window.
        cutoff = _ist(2026, 5, 29, 10, 30).replace(second=45)
        start, end = session_bounds(datetime(2026, 5, 29).date(), cutoff)
        assert start.time() == time(9, 15)
        assert end == _ist(2026, 5, 29, 10, 30 - GRACE_MINUTES)

    def test_cutoff_never_exceeds_close(self):
        # After close → end stays at 15:30, not 16:55-grace.
        cutoff = _ist(2026, 5, 29, 17, 0)
        _, end = session_bounds(datetime(2026, 5, 29).date(), cutoff)
        assert end.time() == time(15, 30)
