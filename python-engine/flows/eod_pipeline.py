"""
EOD Pipeline — Prefect Flow
============================
Runs after market close (~16:00 IST) for each tracked ticker:
    1. Fetch latest daily candle from yfinance (incremental via watermark)
    2. Upsert to raw.historical_prices
    3. Quality gate (hard/soft checks)
    4. Compute SMA signals -> analytics.daily_signals
    5. Aggregate bronze ticks -> silver.ohlcv_1min
    6. Update watermark in ops.data_catalog
    7. Emit pipeline metrics to ops.pipeline_metrics
"""

import json
import logging
from datetime import date, timedelta

import pandas as pd
import yfinance as yf
from prefect import flow, task, get_run_logger

from config import settings
from pipeline.quality import run_quality_checks

logger = logging.getLogger("traderetro.eod")

DEFAULT_TICKERS = [
    "RELIANCE.NS", "SBIN.NS", "ICICIBANK.NS", "HDFCBANK.NS", "TCS.NS",
    "ITC.NS", "BHARTIARTL.NS", "BAJFINANCE.NS", "HCLTECH.NS", "INFY.NS",
]

YAHOO_INDEX_MAP = {
    "NIFTY50.NS": "^NSEI",
    "BANKNIFTY.NS": "^NSEBANK",
    # Macro cross-asset keys (no .NS suffix - stored bare in raw.historical_prices)
    "USDINR": "USDINR=X",
    "CRUDE": "CL=F",
    "INDIAVIX": "^INDIAVIX",
}

MACRO_TICKERS = ["USDINR", "CRUDE", "INDIAVIX"]

# Instrument keys for bronze -> silver aggregation
INSTRUMENT_KEYS = [
    "NSE_EQ|INE009A01021",  # RELIANCE
    "NSE_EQ|INE002A01018",  # SBIN
    "NSE_EQ|INE090A01021",  # ICICIBANK
    "NSE_EQ|INE040A01034",  # HDFCBANK
    "NSE_EQ|INE669E01016",  # TCS
    "NSE_EQ|INE154A01025",  # ITC
    "NSE_EQ|INE118H01025",  # BHARTIARTL
    "NSE_EQ|INE028A01039",  # BAJFINANCE
    "NSE_EQ|INE860A01027",  # HCLTECH
    "NSE_EQ|INE467B01029",  # INFY
]


async def ensure_connections():
    """Initialize DB pool and Redis if not already done (standalone flow execution)."""
    import services.db as db_mod
    import services.redis_client as redis_mod
    if db_mod._pool is None:
        await db_mod.init_pool(settings.database_url)
    if redis_mod._redis is None:
        await redis_mod.init_redis()


# ── Shared Tasks ─────────────────────────────────────────────────


@task(retries=2, retry_delay_seconds=10)
async def fetch_daily_candle(ticker: str) -> list[dict]:
    """Fetch latest daily OHLCV from yfinance, starting after the watermark."""
    log = get_run_logger()
    from services.db import get_pool

    pool = get_pool()
    async with pool.acquire() as conn:
        watermark = await conn.fetchval(
            "SELECT high_watermark FROM ops.data_catalog WHERE ticker = $1", ticker
        )

    if watermark:
        start = (watermark + timedelta(days=1)).isoformat()
        log.info("Incremental fetch for %s from %s", ticker, start)
    else:
        start = (date.today() - timedelta(days=30)).isoformat()
        log.info("No watermark for %s, fetching last 30 days", ticker)

    yf_symbol = YAHOO_INDEX_MAP.get(ticker, ticker)
    df = yf.download(yf_symbol, start=start, progress=False, auto_adjust=True)

    if df is None or df.empty:
        log.info("No new data for %s", ticker)
        return []

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    rows = []
    for i in range(len(df)):
        vol_raw = df["Volume"].iloc[i] if "Volume" in df.columns else 0
        vol = 0 if pd.isna(vol_raw) else int(vol_raw)
        rows.append({
            "date": df.index[i].date(),
            "open": round(float(df["Open"].iloc[i]), 4),
            "high": round(float(df["High"].iloc[i]), 4),
            "low": round(float(df["Low"].iloc[i]), 4),
            "close": round(float(df["Close"].iloc[i]), 4),
            "volume": vol,
        })

    log.info("Fetched %d candles for %s", len(rows), ticker)
    return rows


@task
async def upsert_raw_prices(ticker: str, rows: list[dict]) -> int:
    """Upsert daily OHLCV rows into raw.historical_prices."""
    if not rows:
        return 0

    from services.db import get_pool
    pool = get_pool()

    tuples = [
        (ticker, r["date"], r["open"], r["high"], r["low"], r["close"], r["volume"])
        for r in rows
    ]

    async with pool.acquire() as conn:
        await conn.executemany(
            "INSERT INTO raw.historical_prices "
            "(ticker, trade_date, open_price, high_price, low_price, close_price, volume) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7) "
            "ON CONFLICT (ticker, trade_date) DO NOTHING",
            tuples,
        )

    get_run_logger().info("Upserted %d rows for %s", len(tuples), ticker)
    return len(tuples)


@task
async def quality_gate(ticker: str, only_recent: bool = True) -> dict:
    """Run data quality checks. Returns result dict."""
    result = await run_quality_checks(ticker, only_recent=only_recent)
    log = get_run_logger()
    if result["hard_fail"]:
        log.error("DQ HARD FAIL for %s: %s", ticker, result["hard_failures"])
    elif result["soft_warnings"]:
        log.warning("DQ warnings for %s: %s", ticker, result["soft_warnings"])
    else:
        log.info("DQ passed for %s (%d rows)", ticker, result["rows_checked"])
    return result


@task
async def compute_signals(ticker: str) -> int:
    """Compute SMA 20/50/200 and daily return, upsert to analytics.daily_signals."""
    from services.db import get_pool
    pool = get_pool()
    log = get_run_logger()

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT trade_date, close_price FROM raw.historical_prices "
            "WHERE ticker = $1 ORDER BY trade_date ASC",
            ticker,
        )

    if not rows:
        log.warning("No raw data for %s, skipping signals", ticker)
        return 0

    df = pd.DataFrame([dict(r) for r in rows])
    df["close_price"] = df["close_price"].astype(float)
    df["sma_20"] = df["close_price"].rolling(20).mean().round(2)
    df["sma_50"] = df["close_price"].rolling(50).mean().round(2)
    df["sma_200"] = df["close_price"].rolling(200).mean().round(2)
    df["daily_return_pct"] = (df["close_price"].pct_change() * 100).round(4)

    tuples = []
    for _, r in df.iterrows():
        tuples.append((
            ticker,
            r["trade_date"],
            float(r["close_price"]),
            None if pd.isna(r["sma_20"]) else float(r["sma_20"]),
            None if pd.isna(r["sma_50"]) else float(r["sma_50"]),
            None if pd.isna(r["sma_200"]) else float(r["sma_200"]),
            None if pd.isna(r["daily_return_pct"]) else float(r["daily_return_pct"]),
        ))

    async with pool.acquire() as conn:
        await conn.executemany(
            "INSERT INTO analytics.daily_signals "
            "(ticker, trade_date, close_price, sma_20, sma_50, sma_200, daily_return_pct) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7) "
            "ON CONFLICT (ticker, trade_date) DO UPDATE SET "
            "close_price=EXCLUDED.close_price, sma_20=EXCLUDED.sma_20, "
            "sma_50=EXCLUDED.sma_50, sma_200=EXCLUDED.sma_200, "
            "daily_return_pct=EXCLUDED.daily_return_pct",
            tuples,
        )

    log.info("Upserted %d signal rows for %s", len(tuples), ticker)
    return len(tuples)


@task
async def aggregate_ticks_to_silver(instrument_key: str, trade_date: date | None = None) -> int:
    """Aggregate bronze ticks into silver 1-minute OHLCV bars for a given day."""
    from services.db import get_pool
    pool = get_pool()
    target = trade_date or date.today()
    log = get_run_logger()

    async with pool.acquire() as conn:
        result = await conn.execute("""
            INSERT INTO silver.ohlcv_1min
                (instrument_key, bucket, open, high, low, close, volume, trade_count)
            SELECT
                instrument_key,
                time_bucket('1 minute', timestamp) AS bucket,
                first(ltp, timestamp)  AS open,
                max(ltp)               AS high,
                min(ltp)               AS low,
                last(ltp, timestamp)   AS close,
                max(volume)            AS volume,
                count(*)               AS trade_count
            FROM bronze.market_ticks
            WHERE instrument_key = $1 AND timestamp::date = $2
            GROUP BY instrument_key, bucket
            ON CONFLICT (instrument_key, bucket) DO UPDATE SET
                open  = EXCLUDED.open,  high = EXCLUDED.high,
                low   = EXCLUDED.low,   close = EXCLUDED.close,
                volume = EXCLUDED.volume, trade_count = EXCLUDED.trade_count
        """, instrument_key, target)

    count = int(result.split()[-1]) if result else 0
    if count > 0:
        log.info("Aggregated %d 1min bars for %s on %s", count, instrument_key, target)
    return count


@task
async def update_watermark(ticker: str) -> None:
    """Advance high watermark in ops.data_catalog."""
    from services.db import get_pool
    pool = get_pool()
    async with pool.acquire() as conn:
        # Use separate params to avoid asyncpg type-ambiguity with $1 reuse
        bounds = await conn.fetchrow(
            "SELECT MIN(trade_date) AS lo, MAX(trade_date) AS hi "
            "FROM raw.historical_prices WHERE ticker = $1",
            ticker,
        )
        if bounds and bounds["hi"]:
            await conn.execute(
                "INSERT INTO ops.data_catalog (ticker, first_trade_date, high_watermark, last_refreshed) "
                "VALUES ($1, $2, $3, CURRENT_TIMESTAMP) "
                "ON CONFLICT (ticker) DO UPDATE SET "
                "high_watermark = EXCLUDED.high_watermark, last_refreshed = EXCLUDED.last_refreshed",
                ticker, bounds["lo"], bounds["hi"],
            )
    get_run_logger().info("Watermark updated for %s", ticker)


@task
async def log_ingestion(ticker: str, load_type: str, rows_fetched: int,
                        rows_inserted: int, status: str,
                        error_message: str | None = None) -> int:
    """Write to ops.ingestion_log audit trail."""
    from services.db import get_pool
    pool = get_pool()
    async with pool.acquire() as conn:
        run_id = await conn.fetchval(
            "INSERT INTO ops.ingestion_log "
            "(ticker, load_type, rows_fetched, rows_inserted, status, error_message, finished_at) "
            "VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING run_id",
            ticker, load_type, rows_fetched, rows_inserted, status, error_message,
        )
    return run_id


@task
async def emit_metric(name: str, value: float, labels: dict | None = None) -> None:
    """Write a pipeline metric for Grafana dashboards."""
    from services.db import get_pool
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO ops.pipeline_metrics (metric_name, metric_value, labels) "
            "VALUES ($1, $2, $3)",
            name, value, json.dumps(labels or {}),
        )


# ── Main Flow ────────────────────────────────────────────────────


@flow(name="eod-pipeline", log_prints=True)
async def eod_pipeline(tickers: list[str] | None = None):
    """
    End-of-day pipeline: fetch -> quality gate -> signals -> aggregate -> watermark.
    """
    await ensure_connections()
    log = get_run_logger()

    tickers = tickers or DEFAULT_TICKERS
    log.info("EOD pipeline starting for %d tickers", len(tickers))

    results = {"success": [], "failed": [], "skipped": []}

    for ticker in tickers:
        try:
            rows = await fetch_daily_candle(ticker)

            if not rows:
                results["skipped"].append(ticker)
                await log_ingestion(ticker, "incremental", 0, 0, "success")
                continue

            inserted = await upsert_raw_prices(ticker, rows)

            dq = await quality_gate(ticker, only_recent=True)
            if dq["hard_fail"]:
                await log_ingestion(
                    ticker, "incremental", len(rows), inserted, "failed",
                    f"DQ hard fail: {dq['hard_failures']}",
                )
                results["failed"].append(ticker)
                continue

            await compute_signals(ticker)
            await update_watermark(ticker)
            await log_ingestion(ticker, "incremental", len(rows), inserted, "success")
            await emit_metric("eod_rows_ingested", float(inserted), {"ticker": ticker})
            results["success"].append(ticker)

        except Exception as exc:
            log.error("EOD failed for %s: %s", ticker, exc)
            await log_ingestion(ticker, "incremental", 0, 0, "failed", str(exc))
            results["failed"].append(ticker)

    # Aggregate bronze ticks to silver for today
    for ik in INSTRUMENT_KEYS:
        try:
            await aggregate_ticks_to_silver(ik)
        except Exception as exc:
            log.warning("Silver aggregation failed for %s: %s", ik, exc)

    await emit_metric("eod_pipeline_completed", 1.0, {
        "success": len(results["success"]),
        "failed": len(results["failed"]),
        "skipped": len(results["skipped"]),
    })

    log.info(
        "EOD pipeline complete: %d success, %d failed, %d skipped",
        len(results["success"]), len(results["failed"]), len(results["skipped"]),
    )
    return results
