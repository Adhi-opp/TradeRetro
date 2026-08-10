"""
Gold layer refresh + completeness reconciliation.

The problem this exists to solve
--------------------------------
`gold.ohlcv_5min` and `gold.ohlcv_daily` are TimescaleDB continuous
aggregates with trailing refresh policies (2 hours and 3 days). The policy
only materializes buckets inside that trailing window. Any silver bar whose
bucket falls out of the window before the policy next fires is never
materialized, and nothing ever goes back for it.

That is fine for a pipeline that runs 24/7. It is not fine for one that runs
in bursts — start the stack, work, stop for a week — which is exactly how a
single-host deployment gets used. Measured on 2026-08-10, before this module
existed: gold.ohlcv_5min was 68.7% complete and gold.ohlcv_daily 46.1%, with
four of eight silver days missing entirely, while the Data Quality screen
reported "healthy / 100% backfilled" because it only inspected
raw.historical_prices.

Two pieces:
    refresh_gold_aggregates()  — full-range materialize, run once at worker
                                 startup, so restarts heal whatever the
                                 trailing policies skipped.
    gold_completeness()        — silver vs gold bucket counts, surfaced by
                                 /api/quality/audit so the dashboard can no
                                 longer report healthy while gold is short.
"""

import asyncio
import logging

from services.db import get_pool

logger = logging.getLogger("traderetro.gold_refresh")

# (continuous aggregate, silver bucket width) — the width is what silver
# buckets roll up into, used by the completeness check.
GOLD_AGGREGATES = [
    ("gold.ohlcv_5min", "5 minutes"),
    ("gold.ohlcv_daily", "1 day"),
]

# Below this, the gold layer is materially behind silver and the pipeline
# should not be reported as healthy.
COMPLETENESS_WARN_PCT = 99.0
COMPLETENESS_FAIL_PCT = 90.0


async def refresh_gold_aggregates() -> dict:
    """
    Materialize every continuous aggregate over its full range.

    `CALL refresh_continuous_aggregate(cagg, NULL, NULL)` cannot run inside a
    transaction block, so each call goes out on its own autocommit statement.
    Idempotent: re-materializing an already-current bucket is a no-op.
    """
    pool = get_pool()
    results = {}

    for cagg, _width in GOLD_AGGREGATES:
        try:
            async with pool.acquire() as conn:
                await conn.execute(f"CALL refresh_continuous_aggregate('{cagg}', NULL, NULL)")
            results[cagg] = "refreshed"
            logger.info("Refreshed %s over full range", cagg)
        except Exception as exc:
            results[cagg] = f"failed: {exc}"
            logger.error("Full-range refresh of %s failed: %s", cagg, exc)

    return results


# `width` and `gold_table` are interpolated, not bound: asyncpg maps an
# interval parameter to timedelta, and time_bucket() needs a literal here.
# Both values come from the GOLD_AGGREGATES constant above — never user input.
_COMPLETENESS_SQL = """
WITH expected AS (
    SELECT instrument_key, time_bucket(INTERVAL '{width}', bucket) AS b
    FROM silver.ohlcv_1min
    GROUP BY 1, 2
)
SELECT
    (SELECT count(*) FROM expected)     AS expected_buckets,
    (SELECT count(*) FROM {gold_table}) AS actual_buckets
"""


async def gold_completeness() -> list[dict]:
    """
    Compare silver-derived expected buckets against what gold actually holds.

    Returns one row per aggregate with a status of ok / warning / critical,
    so the quality audit can fail loudly instead of reporting healthy while
    half the gold layer is missing.
    """
    pool = get_pool()
    out = []

    async with pool.acquire() as conn:
        for cagg, width in GOLD_AGGREGATES:
            try:
                row = await conn.fetchrow(
                    _COMPLETENESS_SQL.format(gold_table=cagg, width=width)
                )
                expected = int(row["expected_buckets"] or 0)
                actual = int(row["actual_buckets"] or 0)
            except Exception as exc:
                out.append({
                    "layer": cagg, "expected": None, "actual": None,
                    "completeness_pct": None, "status": "errored", "error": str(exc),
                })
                continue

            pct = round(100.0 * actual / expected, 1) if expected else 100.0
            if pct >= COMPLETENESS_WARN_PCT:
                status = "ok"
            elif pct >= COMPLETENESS_FAIL_PCT:
                status = "warning"
            else:
                status = "critical"

            out.append({
                "layer": cagg,
                "expected": expected,
                "actual": actual,
                "missing": max(0, expected - actual),
                "completeness_pct": pct,
                "status": status,
            })

    return out


async def refresh_and_report() -> dict:
    """Refresh, then measure — used at startup and by the manual endpoint."""
    refreshed = await refresh_gold_aggregates()
    completeness = await gold_completeness()

    for row in completeness:
        if row.get("status") in ("warning", "critical"):
            logger.warning(
                "Gold layer %s only %.1f%% complete (%s/%s buckets)",
                row["layer"], row["completeness_pct"], row["actual"], row["expected"],
            )

    return {"refreshed": refreshed, "completeness": completeness}


async def startup_backfill(delay_seconds: int = 20) -> None:
    """
    One-shot catch-up shortly after the worker boots.

    Delayed so the silver aggregator's own cold-start pass lands first —
    otherwise we would materialize gold from a silver table that is still
    being filled, and immediately be stale again.
    """
    await asyncio.sleep(delay_seconds)
    try:
        report = await refresh_and_report()
        logger.info("Gold startup backfill complete: %s", report["completeness"])
    except Exception as exc:
        logger.error("Gold startup backfill failed: %s", exc)
