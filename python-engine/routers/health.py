"""
Health Check Router — reports database, Redis, and pipeline status.
"""

from fastapi import APIRouter

from services.db import get_pool
from services.redis_client import LATEST_TICK_HASH, get_redis, stream_info

router = APIRouter()


@router.get("/api/health")
async def health():
    checks = {"engine": "python", "dataSource": "timescaledb_medallion"}

    # Database check
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            version = await conn.fetchval("SELECT version();")
        checks["database"] = "connected"
        checks["pg_version"] = version
    except Exception as exc:
        checks["database"] = "disconnected"
        checks["db_error"] = str(exc)

    # Redis check
    try:
        r = get_redis()
        await r.ping()
        checks["redis"] = "connected"
        checks["stream"] = await stream_info()
    except Exception as exc:
        checks["redis"] = "disconnected"
        checks["redis_error"] = str(exc)

    # Overall status
    db_ok = checks.get("database") == "connected"
    redis_ok = checks.get("redis") == "connected"
    if db_ok and redis_ok:
        checks["status"] = "healthy"
    elif db_ok or redis_ok:
        checks["status"] = "degraded"
    else:
        checks["status"] = "unhealthy"

    return checks


@router.get("/api/health/pipeline")
async def pipeline_health():
    """
    Medallion + live-tick health snapshot.

    Surfaces the data engineering story: bronze ticks flowing in,
    silver 1-min bars aggregating out, gold rollups available, and
    the EOD raw layer's freshness.
    """
    snapshot: dict = {}

    # ── Live tick rate from Redis + bronze table ────────────────
    try:
        r = get_redis()
        snapshot["redis_stream_len"] = await r.xlen("market:ticks")
        snapshot["redis_latest_symbols"] = await r.hlen(LATEST_TICK_HASH)
    except Exception as exc:
        snapshot["redis_error"] = str(exc)

    # ── Medallion layer counts + freshness ─────────────────────
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            bronze = await conn.fetchrow(
                """
                SELECT
                    count(*)                                       AS total_rows,
                    max(timestamp)                                 AS latest_ts,
                    count(*) FILTER (WHERE timestamp > now() - interval '1 minute') AS ticks_last_min,
                    count(*) FILTER (WHERE timestamp > now() - interval '5 minutes') AS ticks_last_5min,
                    count(DISTINCT instrument_key)                 AS instruments
                FROM bronze.market_ticks
                """
            )
            silver = await conn.fetchrow(
                """
                SELECT count(*) AS bars, max(bucket) AS latest_bucket,
                       count(DISTINCT instrument_key) AS instruments
                FROM silver.ohlcv_1min
                """
            )
            gold_5min = await conn.fetchrow(
                "SELECT count(*) AS bars, max(bucket_5m) AS latest_bucket FROM gold.ohlcv_5min"
            )
            gold_daily = await conn.fetchrow(
                "SELECT count(*) AS bars, max(trade_date) AS latest_bucket FROM gold.ohlcv_daily"
            )
            raw = await conn.fetchrow(
                """
                SELECT count(*) AS rows,
                       max(trade_date) AS latest_date,
                       count(DISTINCT ticker) AS tickers
                FROM raw.historical_prices
                """
            )

        snapshot["bronze"] = {
            "table": "bronze.market_ticks",
            "rows": bronze["total_rows"],
            "instruments": bronze["instruments"],
            "latest_ts": bronze["latest_ts"].isoformat() if bronze["latest_ts"] else None,
            "ticks_per_minute": bronze["ticks_last_min"],
            "ticks_last_5min": bronze["ticks_last_5min"],
        }
        snapshot["silver"] = {
            "table": "silver.ohlcv_1min",
            "bars": silver["bars"],
            "instruments": silver["instruments"],
            "latest_bucket": silver["latest_bucket"].isoformat() if silver["latest_bucket"] else None,
        }
        snapshot["gold_5min"] = {
            "view": "gold.ohlcv_5min",
            "bars": gold_5min["bars"],
            "latest_bucket": gold_5min["latest_bucket"].isoformat() if gold_5min["latest_bucket"] else None,
        }
        snapshot["gold_daily"] = {
            "view": "gold.ohlcv_daily",
            "bars": gold_daily["bars"],
            "latest_bucket": gold_daily["latest_bucket"].isoformat() if gold_daily["latest_bucket"] else None,
        }
        snapshot["raw"] = {
            "table": "raw.historical_prices",
            "rows": raw["rows"],
            "tickers": raw["tickers"],
            "latest_date": raw["latest_date"].isoformat() if raw["latest_date"] else None,
        }
    except Exception as exc:
        snapshot["db_error"] = str(exc)

    return snapshot
