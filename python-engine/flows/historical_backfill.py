"""
Historical Backfill — Prefect Flow
===================================
Bulk-loads historical OHLCV data from yfinance into raw.historical_prices.
Wraps the existing ingestion logic in Prefect tasks for observability.

Usage:
    POST /api/ingest/backfill {"tickers": ["RELIANCE.NS"], "period": "10y"}
"""

import pandas as pd
import yfinance as yf
from prefect import flow, task, get_run_logger

from flows.eod_pipeline import (
    ensure_connections,
    upsert_raw_prices,
    quality_gate,
    compute_signals,
    update_watermark,
    log_ingestion,
    emit_metric,
    DEFAULT_TICKERS,
    YAHOO_INDEX_MAP,
)


@task(retries=2, retry_delay_seconds=30)
async def fetch_historical(ticker: str, period: str = "10y") -> list[dict]:
    """Fetch long-range history from yfinance."""
    log = get_run_logger()
    yf_symbol = YAHOO_INDEX_MAP.get(ticker, ticker)

    log.info("Fetching %s history for %s (yf: %s)", period, ticker, yf_symbol)
    df = yf.download(yf_symbol, period=period, progress=False, auto_adjust=True)

    if df is None or df.empty:
        log.warning("No data for %s", ticker)
        return []

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    rows = []
    for i in range(len(df)):
        rows.append({
            "date": df.index[i].date(),
            "open": round(float(df["Open"].iloc[i]), 2),
            "high": round(float(df["High"].iloc[i]), 2),
            "low": round(float(df["Low"].iloc[i]), 2),
            "close": round(float(df["Close"].iloc[i]), 2),
            "volume": int(df["Volume"].iloc[i]),
        })

    log.info("Fetched %d historical rows for %s", len(rows), ticker)
    return rows


@flow(name="historical-backfill", log_prints=True)
async def historical_backfill(
    tickers: list[str] | None = None,
    period: str = "10y",
):
    """Bulk backfill historical data from yfinance."""
    await ensure_connections()
    log = get_run_logger()

    tickers = tickers or DEFAULT_TICKERS
    log.info("Backfill starting: %d tickers, period=%s", len(tickers), period)

    results = {"success": [], "failed": []}

    for ticker in tickers:
        try:
            rows = await fetch_historical(ticker, period)

            if not rows:
                await log_ingestion(ticker, "full", 0, 0, "success")
                results["success"].append(ticker)
                continue

            inserted = await upsert_raw_prices(ticker, rows)

            dq = await quality_gate(ticker, only_recent=False)
            if dq["hard_fail"]:
                await log_ingestion(
                    ticker, "full", len(rows), inserted, "failed",
                    f"DQ hard fail: {dq['hard_failures']}",
                )
                results["failed"].append(ticker)
                continue

            signal_count = await compute_signals(ticker)
            await update_watermark(ticker)
            await log_ingestion(ticker, "full", len(rows), inserted, "success")
            await emit_metric("backfill_rows", float(len(rows)), {"ticker": ticker})
            results["success"].append(ticker)

            log.info(
                "Backfill complete for %s: %d rows, %d signals",
                ticker, len(rows), signal_count,
            )

        except Exception as exc:
            log.error("Backfill failed for %s: %s", ticker, exc)
            await log_ingestion(ticker, "full", 0, 0, "failed", str(exc))
            results["failed"].append(ticker)

    log.info(
        "Backfill done: %d success, %d failed",
        len(results["success"]), len(results["failed"]),
    )
    return results
