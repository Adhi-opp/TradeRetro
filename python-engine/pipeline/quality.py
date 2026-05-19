"""
Data Quality Gate (async)
=========================
Validates OHLCV data in raw.historical_prices before signal computation.
Checks split into HARD (block pipeline) and SOFT (warn but continue).

Refactored from python-quant-engine/src/ingestion/quality.py to use
the shared asyncpg pool instead of psycopg2.
"""

import logging
from datetime import date as dt_date

from services.db import get_pool

logger = logging.getLogger("traderetro.quality")

# ── Check definitions ────────────────────────────────────────────
# Each tuple: (name, SQL template with {f} for recency filter, detail template)

HARD_CHECKS = [
    ("close_positive",
     "SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = $1 {f} AND close_price <= 0",
     "{n} rows have close_price <= 0"),
    ("high_gte_low",
     "SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = $1 {f} AND high_price < low_price",
     "{n} rows have high < low (impossible candle)"),
    ("no_future_dates",
     "SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = $1 {f} AND trade_date > CURRENT_DATE",
     "{n} rows have trade_date in the future"),
    ("no_null_ohlc",
     "SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = $1 {f} "
     "AND (open_price IS NULL OR high_price IS NULL OR low_price IS NULL OR close_price IS NULL)",
     "{n} rows have NULL in OHLC columns"),
]

SOFT_CHECKS = [
    ("volume_positive",
     "SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = $1 {f} AND volume <= 0",
     "{n} rows have volume <= 0"),
    ("high_gte_open_close",
     "SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = $1 {f} "
     "AND (high_price < open_price OR high_price < close_price)",
     "{n} rows have high < open or high < close"),
    ("low_lte_open_close",
     "SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = $1 {f} "
     "AND (low_price > open_price OR low_price > close_price)",
     "{n} rows have low > open or low > close"),
]


async def run_quality_checks(ticker: str, only_recent: bool = False) -> dict:
    """
    Run all OHLCV quality checks for a ticker.

    Returns:
        {"hard_fail": bool, "hard_failures": [...], "soft_warnings": [...], "rows_checked": int}
    """
    pool = get_pool()
    f = "AND trade_date >= CURRENT_DATE" if only_recent else ""

    async with pool.acquire() as conn:
        rows_checked = await conn.fetchval(
            f"SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = $1 {f}", ticker
        )

        if rows_checked == 0:
            return {"hard_fail": False, "hard_failures": [], "soft_warnings": [], "rows_checked": 0}

        hard_failures = []
        for name, sql, detail_tpl in HARD_CHECKS:
            count = await conn.fetchval(sql.replace("{f}", f), ticker)
            if count > 0:
                hard_failures.append({"check": name, "detail": detail_tpl.format(n=count), "row_count": count})

        soft_warnings = []
        for name, sql, detail_tpl in SOFT_CHECKS:
            count = await conn.fetchval(sql.replace("{f}", f), ticker)
            if count > 0:
                soft_warnings.append({"check": name, "detail": detail_tpl.format(n=count), "row_count": count})

    hard_fail = len(hard_failures) > 0
    if hard_fail:
        logger.error("DQ HARD FAIL for %s: %s", ticker, hard_failures)
    if soft_warnings:
        logger.warning("DQ warnings for %s: %s", ticker, soft_warnings)
    if not hard_fail and not soft_warnings:
        logger.info("DQ passed for %s (%d rows)", ticker, rows_checked)

    return {
        "hard_fail": hard_fail,
        "hard_failures": hard_failures,
        "soft_warnings": soft_warnings,
        "rows_checked": rows_checked,
    }


# NIFTY 50 is the NSE benchmark — any date NIFTY trades is an NSE trading
# day. Using it as canonical avoids hardcoding a holiday calendar and
# avoids false positives from forex/commodity tickers that trade on
# Indian holidays (USDINR, CRUDE).
NSE_CALENDAR_TICKER = "NIFTY50.NS"


async def run_gap_detection(ticker: str) -> dict:
    """
    Detect missing NSE trading days for a ticker.

    Uses NIFTY50.NS as the canonical NSE trading calendar. A date is a
    "real gap" only if NIFTY traded on it but this ticker didn't. NSE
    holidays (where NIFTY itself didn't trade) are excluded automatically.

    For non-equity tickers (USDINR, CRUDE) that trade on more days than
    NSE, this only flags missing NSE-equity dates — which is the right
    behaviour since the warehouse is aligned to NSE sessions.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        gaps = await conn.fetch(
            """
            WITH bounds AS (
                SELECT MIN(trade_date) AS lo, MAX(trade_date) AS hi
                FROM raw.historical_prices WHERE ticker = $1
            ),
            ticker_dates AS (
                SELECT trade_date FROM raw.historical_prices WHERE ticker = $1
            ),
            nse_calendar AS (
                SELECT trade_date
                FROM raw.historical_prices
                WHERE ticker = $2
                  AND trade_date BETWEEN (SELECT lo FROM bounds) AND (SELECT hi FROM bounds)
            )
            SELECT n.trade_date AS expected_date
            FROM nse_calendar n
            LEFT JOIN ticker_dates t ON n.trade_date = t.trade_date
            WHERE t.trade_date IS NULL
            ORDER BY n.trade_date
            """,
            ticker, NSE_CALENDAR_TICKER,
        )

    gap_dates = [r["expected_date"].isoformat() for r in gaps]
    return {
        "ticker": ticker,
        "gap_count": len(gap_dates),
        "gaps": gap_dates[:50],
    }


async def run_staleness_check(ticker: str) -> dict:
    """Check if data is stale (latest date far from today)."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT MAX(trade_date) AS latest, COUNT(*) AS total_rows
            FROM raw.historical_prices WHERE ticker = $1
        """, ticker)

    if not row or row["latest"] is None:
        return {"ticker": ticker, "stale": True, "latest_date": None, "days_behind": None, "total_rows": 0}

    days_behind = (dt_date.today() - row["latest"]).days
    return {
        "ticker": ticker,
        "stale": days_behind > 3,
        "latest_date": row["latest"].isoformat(),
        "days_behind": days_behind,
        "total_rows": row["total_rows"],
    }
