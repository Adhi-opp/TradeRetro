"""
Data Quality Gate
=================
Validates OHLCV rows in raw.historical_prices before signal computation.
Checks are split into HARD (block pipeline) and SOFT (warn but continue).

Usage:
    result = run_quality_checks(ticker, conn, only_recent=True)
    if result["hard_fail"]:
        # block signal computation, log the failures
    else:
        # proceed, but log any soft warnings
"""

import logging
from datetime import date

logger = logging.getLogger("traderetro.quality")


def run_quality_checks(ticker: str, conn, only_recent: bool = False) -> dict:
    """
    Run all OHLCV quality checks for a ticker.

    Args:
        ticker: The ticker symbol to validate.
        conn: An open psycopg2 connection.
        only_recent: If True, only check rows loaded today (incremental).

    Returns:
        {
            "hard_fail": bool,
            "hard_failures": [{"check": str, "detail": str, "row_count": int}],
            "soft_warnings": [{"check": str, "detail": str, "row_count": int}],
            "rows_checked": int,
        }
    """
    recency_filter = "AND trade_date >= CURRENT_DATE" if only_recent else ""

    with conn.cursor() as cur:
        # Total rows being checked
        cur.execute(
            f"SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = %s {recency_filter}",
            (ticker,),
        )
        rows_checked = cur.fetchone()[0]

    if rows_checked == 0:
        return {
            "hard_fail": False,
            "hard_failures": [],
            "soft_warnings": [],
            "rows_checked": 0,
        }

    hard_failures = []
    soft_warnings = []

    # ── HARD checks (block pipeline) ──

    # 1. Close price must be positive
    _run_check(
        conn, ticker, recency_filter, hard_failures,
        check_name="close_positive",
        sql="SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = %s {filter} AND close_price <= 0",
        detail_template="{n} rows have close_price <= 0 (corrupt data)",
    )

    # 2. High must be >= Low
    _run_check(
        conn, ticker, recency_filter, hard_failures,
        check_name="high_gte_low",
        sql="SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = %s {filter} AND high_price < low_price",
        detail_template="{n} rows have high < low (impossible candle)",
    )

    # 3. No future dates
    _run_check(
        conn, ticker, recency_filter, hard_failures,
        check_name="no_future_dates",
        sql="SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = %s {filter} AND trade_date > CURRENT_DATE",
        detail_template="{n} rows have trade_date in the future",
    )

    # 4. No null critical columns
    _run_check(
        conn, ticker, recency_filter, hard_failures,
        check_name="no_null_ohlc",
        sql=(
            "SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = %s {filter} "
            "AND (open_price IS NULL OR high_price IS NULL OR low_price IS NULL OR close_price IS NULL)"
        ),
        detail_template="{n} rows have NULL in OHLC columns",
    )

    # ── SOFT checks (warn but continue) ──

    # 5. Volume should be > 0
    _run_check(
        conn, ticker, recency_filter, soft_warnings,
        check_name="volume_positive",
        sql="SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = %s {filter} AND volume <= 0",
        detail_template="{n} rows have volume <= 0 (possible holiday/bad data)",
    )

    # 6. High should be >= Open and Close
    _run_check(
        conn, ticker, recency_filter, soft_warnings,
        check_name="high_gte_open_close",
        sql=(
            "SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = %s {filter} "
            "AND (high_price < open_price OR high_price < close_price)"
        ),
        detail_template="{n} rows have high < open or high < close",
    )

    # 7. Low should be <= Open and Close
    _run_check(
        conn, ticker, recency_filter, soft_warnings,
        check_name="low_lte_open_close",
        sql=(
            "SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = %s {filter} "
            "AND (low_price > open_price OR low_price > close_price)"
        ),
        detail_template="{n} rows have low > open or low > close",
    )

    # 8. Dates should be after 1990 (sanity bound)
    _run_check(
        conn, ticker, recency_filter, soft_warnings,
        check_name="date_after_1990",
        sql="SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = %s {filter} AND trade_date < '1990-01-01'",
        detail_template="{n} rows have trade_date before 1990",
    )

    hard_fail = len(hard_failures) > 0

    if hard_fail:
        logger.error("DQ HARD FAIL for %s: %s", ticker, hard_failures)
    if soft_warnings:
        logger.warning("DQ warnings for %s: %s", ticker, soft_warnings)
    if not hard_fail and not soft_warnings:
        logger.info("DQ passed for %s (%d rows checked)", ticker, rows_checked)

    return {
        "hard_fail": hard_fail,
        "hard_failures": hard_failures,
        "soft_warnings": soft_warnings,
        "rows_checked": rows_checked,
    }


def _run_check(conn, ticker, recency_filter, results_list, *, check_name, sql, detail_template):
    """Execute a single quality check and append to results if violations found."""
    final_sql = sql.replace("{filter}", recency_filter)
    with conn.cursor() as cur:
        cur.execute(final_sql, (ticker,))
        count = cur.fetchone()[0]

    if count > 0:
        results_list.append({
            "check": check_name,
            "detail": detail_template.format(n=count),
            "row_count": count,
        })
