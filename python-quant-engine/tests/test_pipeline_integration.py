"""
Pipeline Integration Test
=========================
End-to-end test that runs the full ingestion pipeline for a single ticker
against a REAL PostgreSQL database and verifies:
  1. Raw data lands in raw.historical_prices
  2. Data quality checks pass
  3. Signals are computed in analytics.daily_signals
  4. ops.ingestion_log has an audit row
  5. ops.data_catalog has a watermark entry

Requires: PostgreSQL running with the ops/raw/analytics schemas created.
Run:  cd python-quant-engine && python -m pytest tests/ -v
"""

import os
import psycopg2
import pytest

from src.ingestion.fetch_ohlcv import main as run_pipeline
from src.ingestion.quality import run_quality_checks


def _get_connection():
    return psycopg2.connect(
        dbname=os.getenv("PGDATABASE", "traderetro_raw"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", "postgres"),
        host=os.getenv("PGHOST", "localhost"),
        port=os.getenv("PGPORT", "5432"),
    )


TEST_TICKER = "RELIANCE.NS"


@pytest.fixture(scope="module")
def pipeline_result():
    """Run the pipeline once for the whole test module."""
    exit_code = run_pipeline(["--symbol", TEST_TICKER, "--period", "1y"])
    return exit_code


class TestRawLayer:
    def test_pipeline_exits_zero(self, pipeline_result):
        assert pipeline_result == 0, "Pipeline should exit with code 0"

    def test_raw_data_exists(self, pipeline_result):
        conn = _get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = %s",
                    (TEST_TICKER,),
                )
                count = cur.fetchone()[0]
            assert count > 0, f"Expected rows in raw.historical_prices for {TEST_TICKER}"
        finally:
            conn.close()


class TestDataQuality:
    def test_no_hard_failures(self, pipeline_result):
        conn = _get_connection()
        try:
            result = run_quality_checks(TEST_TICKER, conn)
            assert not result["hard_fail"], f"DQ hard failures: {result['hard_failures']}"
            assert result["rows_checked"] > 0
        finally:
            conn.close()


class TestAnalyticsLayer:
    def test_signals_exist(self, pipeline_result):
        conn = _get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM analytics.daily_signals WHERE ticker = %s",
                    (TEST_TICKER,),
                )
                count = cur.fetchone()[0]
            assert count > 0, f"Expected signal rows for {TEST_TICKER}"
        finally:
            conn.close()

    def test_sma_values_populated(self, pipeline_result):
        conn = _get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM analytics.daily_signals "
                    "WHERE ticker = %s AND sma_20 IS NOT NULL",
                    (TEST_TICKER,),
                )
                count = cur.fetchone()[0]
            assert count > 0, "SMA-20 should be non-null for some rows"
        finally:
            conn.close()


class TestOpsLayer:
    def test_ingestion_log_exists(self, pipeline_result):
        conn = _get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT status, rows_fetched, rows_inserted, load_type "
                    "FROM ops.ingestion_log WHERE ticker = %s "
                    "ORDER BY run_id DESC LIMIT 1",
                    (TEST_TICKER,),
                )
                row = cur.fetchone()
            assert row is not None, "Expected a row in ops.ingestion_log"
            status, rows_fetched, rows_inserted, load_type = row
            assert status == "success"
            assert rows_fetched >= 0
            assert rows_inserted >= 0
            assert load_type in ("full", "incremental")
        finally:
            conn.close()

    def test_data_catalog_watermark(self, pipeline_result):
        conn = _get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT high_watermark, first_trade_date "
                    "FROM ops.data_catalog WHERE ticker = %s",
                    (TEST_TICKER,),
                )
                row = cur.fetchone()
            assert row is not None, "Expected a row in ops.data_catalog"
            high_watermark, first_trade_date = row
            assert high_watermark is not None, "high_watermark should be set"
            assert first_trade_date is not None, "first_trade_date should be set"
            assert first_trade_date < high_watermark, "first_trade_date should be before watermark"
        finally:
            conn.close()
