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

# TimescaleDB time_bucket() + first()/last() handle OHLC perfectly.
# The look-back window means an in-flight 1-min bucket will be UPSERTed
# multiple times as more ticks arrive — that's fine, each upsert replaces
# with the latest aggregate.
AGGREGATE_SQL = """
INSERT INTO silver.ohlcv_1min
    (instrument_key, bucket, open, high, low, close, volume, trade_count, quality_score, source)
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
    'stream'                           AS source
FROM bronze.market_ticks
WHERE timestamp >= now() - ($1 || ' minutes')::interval
  AND timestamp <  date_trunc('minute', now())  -- only completed buckets
  AND ltp > 0
GROUP BY instrument_key, bucket
ON CONFLICT (instrument_key, bucket) DO UPDATE SET
    open        = EXCLUDED.open,
    high        = EXCLUDED.high,
    low         = EXCLUDED.low,
    close       = EXCLUDED.close,
    volume      = EXCLUDED.volume,
    trade_count = EXCLUDED.trade_count,
    -- real stream ticks reclaim a bucket that was previously reconciled
    source      = 'stream';
"""


async def aggregate_once(window_minutes: int = AGG_WINDOW_MINUTES) -> int:
    """Run one aggregation pass, return rows touched."""
    pool = get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(AGGREGATE_SQL, str(window_minutes))
    # asyncpg returns "INSERT 0 <rowcount>"
    try:
        return int(result.split()[-1])
    except (ValueError, IndexError):
        return 0


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
