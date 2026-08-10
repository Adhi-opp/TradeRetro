"""
Silver Aggregator — bronze.market_ticks → silver.ohlcv_1min

Runs in the pipeline-worker container alongside the consumer. Every
AGG_INTERVAL_SECONDS, re-aggregates the last AGG_WINDOW_MINUTES of
bronze ticks into 1-minute OHLCV bars and UPSERTs them into
silver.ohlcv_1min.

The 5-minute look-back window is idempotent (ON CONFLICT DO UPDATE)
so it self-heals if the worker was briefly down. Gold continuous
aggregates (gold.ohlcv_5min, gold.ohlcv_daily) auto-refresh off
silver per the migration policies — nothing else to wire here.
"""

import asyncio
import logging

from services.db import get_pool

logger = logging.getLogger("traderetro.silver_aggregator")

AGG_INTERVAL_SECONDS = 60     # how often we run
AGG_WINDOW_MINUTES = 5        # how far back we re-aggregate each run

# ── The one and only bronze → silver projection ──────────────────────────────
#
# Every caller (streaming loop, EOD flow, manual backfill) shares this SELECT.
# It used to be duplicated in flows/eod_pipeline.py with `max(volume)` where
# this one has `sum(volume)`, so a bar's volume meant different things
# depending on which writer touched it last. One definition, one owner.
#
# TimescaleDB time_bucket() + first()/last() handle OHLC. Re-running over a
# bucket is deterministic, which is what makes the UPSERT safe.
_PROJECTION = """
SELECT
    instrument_key,
    time_bucket('1 minute', timestamp) AS bucket,
    first(ltp, timestamp)              AS open,
    max(ltp)                           AS high,
    min(ltp)                           AS low,
    last(ltp, timestamp)               AS close,
    sum(volume)::bigint                AS volume,
    count(*)::int                      AS trade_count,
    100                                AS quality_score,
    {source}                           AS source
FROM bronze.market_ticks
WHERE {time_filter}
  AND ltp > 0
  {extra_filter}
GROUP BY instrument_key, bucket
ON CONFLICT (instrument_key, bucket) DO UPDATE SET
    open        = EXCLUDED.open,
    high        = EXCLUDED.high,
    low         = EXCLUDED.low,
    close       = EXCLUDED.close,
    volume      = EXCLUDED.volume,
    trade_count = EXCLUDED.trade_count,
    -- real tick data reclaims a bucket that was previously reconciled
    source      = EXCLUDED.source;
"""

_INSERT_HEAD = """
INSERT INTO silver.ohlcv_1min
    (instrument_key, bucket, open, high, low, close, volume, trade_count, quality_score, source)
"""


def _build_sql(source: str, time_filter: str, extra_filter: str = "") -> str:
    return _INSERT_HEAD + _PROJECTION.format(
        source=f"'{source}'", time_filter=time_filter, extra_filter=extra_filter
    )


# Trailing-window pass, run every AGG_INTERVAL_SECONDS. The look-back means an
# in-flight bucket is UPSERTed repeatedly as more ticks arrive — each pass
# replaces it with the latest aggregate.
AGGREGATE_SQL = _build_sql(
    source="stream",
    time_filter=(
        "timestamp >= now() - ($1 || ' minutes')::interval\n"
        "  AND timestamp <  date_trunc('minute', now())  -- only completed buckets"
    ),
)

# Whole-calendar-day pass for one instrument, used by the EOD flow.
AGGREGATE_DAY_SQL = _build_sql(
    source="stream",
    time_filter="timestamp >= $1::date\n  AND timestamp < ($1::date + INTERVAL '1 day')",
    extra_filter="AND instrument_key = $2",
)


def _rowcount(status: str) -> int:
    """asyncpg returns 'INSERT 0 <rowcount>'."""
    try:
        return int(status.split()[-1])
    except (ValueError, IndexError, AttributeError):
        return 0


async def aggregate_once(window_minutes: int = AGG_WINDOW_MINUTES) -> int:
    """Run one trailing-window aggregation pass, return rows touched."""
    pool = get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(AGGREGATE_SQL, str(window_minutes))
    return _rowcount(result)


async def aggregate_day(instrument_key: str, trade_date) -> int:
    """
    Re-aggregate one instrument's full trading day, bronze → silver.

    Called by the EOD Prefect flow. Idempotent and deterministic: re-running
    it over a day that already has bars produces identical values.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(AGGREGATE_DAY_SQL, trade_date, instrument_key)
    return _rowcount(result)


async def run_aggregator_loop() -> None:
    """Run aggregate_once every AGG_INTERVAL_SECONDS, forever."""
    logger.info(
        "Silver aggregator started: every %ds, %dmin look-back",
        AGG_INTERVAL_SECONDS, AGG_WINDOW_MINUTES,
    )

    # First run: cold start — process the last hour to seed silver with
    # whatever bronze already has.
    try:
        seeded = await aggregate_once(window_minutes=60)
        logger.info("Cold-start aggregation: %d bars upserted", seeded)
    except Exception as exc:
        logger.error("Cold-start aggregation failed: %s", exc)

    while True:
        await asyncio.sleep(AGG_INTERVAL_SECONDS)
        try:
            count = await aggregate_once()
            if count > 0:
                logger.info("Silver aggregator: %d bars upserted", count)
        except Exception as exc:
            logger.error("Silver aggregation failed: %s", exc)
