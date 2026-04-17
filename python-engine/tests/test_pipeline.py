"""
Tests for pipeline logic — quality checks, market hours, flow structures.
These are unit tests that don't require a running database.
"""

import pytest
from datetime import date, time, datetime
from unittest.mock import AsyncMock, patch, MagicMock

try:
    import prefect
    HAS_PREFECT = True
except ImportError:
    HAS_PREFECT = False

requires_prefect = pytest.mark.skipif(not HAS_PREFECT, reason="prefect not installed")


# ── Market Hours Tests ────────────────────────────────────────


class TestMarketHours:
    """Test NSE market hours and holiday calendar."""

    def test_imports(self):
        from pipeline.market_hours import (
            MARKET_OPEN, MARKET_CLOSE, STREAM_START, STREAM_END,
            NSE_HOLIDAYS_2026, is_trading_day, is_stream_window,
        )
        assert MARKET_OPEN == time(9, 15)
        assert MARKET_CLOSE == time(15, 30)

    def test_weekend_not_trading_day(self):
        from pipeline.market_hours import is_trading_day
        # 2026-04-18 is a Saturday
        assert is_trading_day(date(2026, 4, 18)) is False
        # 2026-04-19 is a Sunday
        assert is_trading_day(date(2026, 4, 19)) is False

    def test_weekday_is_trading_day(self):
        from pipeline.market_hours import is_trading_day
        # 2026-04-20 is a Monday (not a holiday)
        assert is_trading_day(date(2026, 4, 20)) is True

    def test_holiday_not_trading_day(self):
        from pipeline.market_hours import is_trading_day, NSE_HOLIDAYS_2026
        if NSE_HOLIDAYS_2026:
            holiday = next(iter(NSE_HOLIDAYS_2026))
            assert is_trading_day(holiday) is False

    def test_stream_window_constants(self):
        from pipeline.market_hours import STREAM_START, STREAM_END
        assert STREAM_START == time(9, 0)
        assert STREAM_END == time(15, 40)

    def test_holiday_count(self):
        from pipeline.market_hours import NSE_HOLIDAYS_2026
        assert len(NSE_HOLIDAYS_2026) >= 15, "NSE has ~15-18 holidays per year"


# ── Quality Check Structure Tests ─────────────────────────────


class TestQualityCheckStructure:
    """Test quality check module exports and constants."""

    def test_quality_module_imports(self):
        from pipeline.quality import (
            run_quality_checks,
            run_gap_detection,
            run_staleness_check,
            HARD_CHECKS,
            SOFT_CHECKS,
        )
        assert callable(run_quality_checks)
        assert callable(run_gap_detection)
        assert callable(run_staleness_check)

    def test_hard_checks_defined(self):
        from pipeline.quality import HARD_CHECKS
        assert len(HARD_CHECKS) >= 3
        # Each check should be a tuple with (name, sql_template, description)
        for check in HARD_CHECKS:
            assert len(check) == 3
            assert isinstance(check[0], str)  # name
            assert isinstance(check[1], str)  # SQL
            assert isinstance(check[2], str)  # description

    def test_soft_checks_defined(self):
        from pipeline.quality import SOFT_CHECKS
        assert len(SOFT_CHECKS) >= 2
        for check in SOFT_CHECKS:
            assert len(check) == 3


# ── Flow Structure Tests ──────────────────────────────────────


@requires_prefect
class TestFlowStructure:
    """Test that Prefect flows and tasks are importable and correctly decorated."""

    def test_eod_pipeline_importable(self):
        from flows.eod_pipeline import (
            eod_pipeline,
            fetch_daily_candle,
            upsert_raw_prices,
            quality_gate,
            compute_signals,
            aggregate_ticks_to_silver,
            update_watermark,
            log_ingestion,
            emit_metric,
            DEFAULT_TICKERS,
            INSTRUMENT_KEYS,
        )
        assert len(DEFAULT_TICKERS) == 10
        assert len(INSTRUMENT_KEYS) == 10

    def test_historical_backfill_importable(self):
        from flows.historical_backfill import (
            historical_backfill,
            fetch_historical,
        )

    def test_quality_audit_importable(self):
        from flows.quality_check import quality_audit

    def test_default_tickers_are_nse(self):
        from flows.eod_pipeline import DEFAULT_TICKERS
        for ticker in DEFAULT_TICKERS:
            assert ticker.endswith(".NS"), f"{ticker} should be an NSE ticker (.NS suffix)"

    def test_instrument_keys_format(self):
        from flows.eod_pipeline import INSTRUMENT_KEYS
        for key in INSTRUMENT_KEYS:
            assert key.startswith("NSE_EQ|"), f"{key} should start with NSE_EQ|"
            assert "|INE" in key, f"{key} should contain ISIN prefix INE"


# ── EOD Pipeline Default Config Tests ─────────────────────────


@requires_prefect
class TestEODPipelineConfig:
    """Test EOD pipeline configuration constants."""

    def test_yahoo_index_map(self):
        from flows.eod_pipeline import YAHOO_INDEX_MAP
        assert "NIFTY50.NS" in YAHOO_INDEX_MAP
        assert YAHOO_INDEX_MAP["NIFTY50.NS"] == "^NSEI"
        assert "BANKNIFTY.NS" in YAHOO_INDEX_MAP
        assert YAHOO_INDEX_MAP["BANKNIFTY.NS"] == "^NSEBANK"
