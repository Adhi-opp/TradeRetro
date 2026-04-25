"""
Correlation Lab Router
======================
Research/visualization endpoints powering the Correlation Lab tab.

    GET /api/correlation/matrix       - NxN heatmap of pairwise Pearson corr on returns
    GET /api/correlation/rolling      - rolling-window corr of base vs peers over time
    GET /api/correlation/leadlag      - lagged-correlation proxy (NOT Granger)
    GET /api/correlation/divergence   - normalized cumulative-% series

All math is delegated to engine.corr_engine so the router stays thin.
Heavy pandas work runs in the default thread executor so the event loop
is never blocked.
"""

import asyncio
import logging
from datetime import date
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from engine import corr_engine
from services.db import get_pool

logger = logging.getLogger("traderetro.correlation")

router = APIRouter(prefix="/api/correlation", tags=["correlation"])


# ── Default universe for each endpoint ───────────────────────────
# Equity heavyweights stored with .NS suffix; indices as NIFTY50.NS / BANKNIFTY.NS;
# macro cross-asset series (USDINR, CRUDE) stored bare.

DEFAULT_MATRIX_TICKERS = [
    "NIFTY50.NS", "BANKNIFTY.NS",
    "RELIANCE.NS", "HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS",
    "TCS.NS", "INFY.NS", "HCLTECH.NS",
    "ITC.NS", "BHARTIARTL.NS", "BAJFINANCE.NS",
    "USDINR", "CRUDE",
]

DEFAULT_PEERS = ["RELIANCE.NS", "HDFCBANK.NS", "ICICIBANK.NS"]

# NIFTY 50 is stored as NIFTY50.NS in raw.historical_prices
DEFAULT_BASE = "NIFTY50.NS"


# ── Ticker key normalization ─────────────────────────────────────
# The frontend may send display names like "NIFTY 50" or "HDFC BANK".
# We map both ways without forcing the user to know the DB convention.

_DISPLAY_TO_KEY = {
    "NIFTY 50": "NIFTY50.NS",
    "NIFTY50": "NIFTY50.NS",
    "BANK NIFTY": "BANKNIFTY.NS",
    "BANKNIFTY": "BANKNIFTY.NS",
    "USDINR": "USDINR",
    "USD/INR": "USDINR",
    "CRUDE": "CRUDE",
    "CRUDE OIL": "CRUDE",
}

_MACRO_KEYS = {"USDINR", "CRUDE"}


def _normalize_ticker(ticker: str) -> str:
    """Coerce a user-supplied ticker to the DB storage key."""
    t = ticker.strip()
    up = t.upper()
    if up in _DISPLAY_TO_KEY:
        return _DISPLAY_TO_KEY[up]
    if up in _MACRO_KEYS:
        return up
    if up.endswith(".NS"):
        return up
    return f"{up}.NS"


# ── Data loader ──────────────────────────────────────────────────


async def _load_wide_prices(
    tickers: list[str],
    min_date: Optional[date] = None,
) -> pd.DataFrame:
    """
    Load close prices for `tickers` from raw.historical_prices and pivot to
    wide format (index=trade_date, columns=ticker, values=close_price).
    """
    if not tickers:
        return pd.DataFrame()

    pool = get_pool()
    query = (
        "SELECT ticker, trade_date, close_price "
        "FROM raw.historical_prices "
        "WHERE ticker = ANY($1::text[])"
    )
    params: list = [tickers]

    if min_date is not None:
        query += " AND trade_date >= $2"
        params.append(min_date)

    query += " ORDER BY trade_date ASC"

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame([dict(r) for r in rows])
    df["close_price"] = pd.to_numeric(df["close_price"], errors="coerce").astype(float)
    df["trade_date"] = pd.to_datetime(df["trade_date"])
    wide = df.pivot_table(
        index="trade_date",
        columns="ticker",
        values="close_price",
        aggfunc="last",
    ).sort_index()
    return wide


def _empty_warehouse(window: int) -> dict:
    return {
        "tickers": [],
        "matrix": [],
        "window_days": window,
        "n_samples": 0,
        "excluded_due_to_missing_data": [],
        "status": "insufficient_data",
        "required": window,
        "available": 0,
        "reason": "warehouse has no rows for the requested tickers - run /api/ingest/backfill first",
    }


async def _run_in_thread(fn, *args, **kwargs):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))


# ── Endpoints ────────────────────────────────────────────────────


@router.get("/matrix")
async def correlation_matrix(
    window_days: int = Query(20, ge=3, le=500),
    tickers: Optional[list[str]] = Query(None),
):
    """N×N Pearson correlation on log-returns over the last `window_days`."""
    requested = [_normalize_ticker(t) for t in (tickers or DEFAULT_MATRIX_TICKERS)]

    try:
        prices = await _load_wide_prices(requested)
    except Exception as exc:
        logger.exception("matrix: warehouse load failed")
        raise HTTPException(status_code=500, detail=f"warehouse query failed: {exc}") from exc

    if prices.empty:
        payload = _empty_warehouse(window_days)
        payload["requested_tickers"] = requested
        return payload

    result = await _run_in_thread(corr_engine.compute_corr_matrix, prices, window_days)

    result["as_of"] = prices.index[-1].date().isoformat()
    result["requested_tickers"] = requested
    result["data_source"] = "raw.historical_prices"
    return result


@router.get("/rolling")
async def rolling_correlation(
    base: str = Query(DEFAULT_BASE),
    peers: list[str] = Query(default_factory=lambda: list(DEFAULT_PEERS)),
    window_days: int = Query(20, ge=3, le=120),
    lookback_days: int = Query(120, ge=10, le=750),
):
    """Rolling-window correlation of base vs each peer, stepped daily."""
    base_key = _normalize_ticker(base)
    peer_keys = [_normalize_ticker(p) for p in peers]
    tickers = list({base_key, *peer_keys})

    try:
        prices = await _load_wide_prices(tickers)
    except Exception as exc:
        logger.exception("rolling: warehouse load failed")
        raise HTTPException(status_code=500, detail=f"warehouse query failed: {exc}") from exc

    if prices.empty:
        return {
            "base": base_key,
            "peers": peer_keys,
            "window_days": window_days,
            "lookback_days": lookback_days,
            "series": [],
            "status": "insufficient_data",
            "required": window_days + lookback_days,
            "available": 0,
            "reason": "warehouse has no rows for the requested tickers",
            "data_source": "raw.historical_prices",
        }

    result = await _run_in_thread(
        corr_engine.compute_rolling_corr,
        prices, base_key, peer_keys, window_days, lookback_days,
    )
    result["data_source"] = "raw.historical_prices"
    return result


@router.get("/leadlag")
async def lead_lag(
    base: str = Query(DEFAULT_BASE),
    peers: list[str] = Query(default_factory=lambda: list(DEFAULT_PEERS)),
    max_lag: int = Query(5, ge=1, le=30),
    window_days: int = Query(60, ge=10, le=500),
):
    """
    Lagged-correlation proxy: for each peer, pick the lag k that maximizes
    abs(corr(base_t, peer_{t-k})). NOT Granger causality - see `disclaimer` field.
    """
    base_key = _normalize_ticker(base)
    peer_keys = [_normalize_ticker(p) for p in peers]
    tickers = list({base_key, *peer_keys})

    try:
        prices = await _load_wide_prices(tickers)
    except Exception as exc:
        logger.exception("leadlag: warehouse load failed")
        raise HTTPException(status_code=500, detail=f"warehouse query failed: {exc}") from exc

    if prices.empty:
        return {
            "base": base_key,
            "results": [],
            "lead_lag_proxy": True,
            "disclaimer": (
                "Lagged-correlation proxy - not true Granger causality. "
                "Positive best_lag_bars means the peer's moves precede the base's."
            ),
            "status": "insufficient_data",
            "required": window_days,
            "available": 0,
            "reason": "warehouse has no rows for the requested tickers",
            "data_source": "raw.historical_prices",
        }

    result = await _run_in_thread(
        corr_engine.compute_lead_lag,
        prices, base_key, peer_keys, max_lag, window_days,
    )
    result["data_source"] = "raw.historical_prices"
    return result


@router.get("/divergence")
async def heavyweight_divergence(
    base: str = Query(DEFAULT_BASE),
    peers: list[str] = Query(default_factory=lambda: list(DEFAULT_PEERS)),
    lookback_days: int = Query(60, ge=5, le=500),
):
    """Normalized cumulative % change vs first observation in the window."""
    base_key = _normalize_ticker(base)
    peer_keys = [_normalize_ticker(p) for p in peers]
    tickers = list({base_key, *peer_keys})

    try:
        prices = await _load_wide_prices(tickers)
    except Exception as exc:
        logger.exception("divergence: warehouse load failed")
        raise HTTPException(status_code=500, detail=f"warehouse query failed: {exc}") from exc

    if prices.empty:
        return {
            "base": base_key,
            "lookback_days": lookback_days,
            "series": [],
            "status": "insufficient_data",
            "required": lookback_days,
            "available": 0,
            "reason": "warehouse has no rows for the requested tickers",
            "data_source": "raw.historical_prices",
        }

    result = await _run_in_thread(
        corr_engine.compute_divergence,
        prices, base_key, peer_keys, lookback_days,
    )
    result["data_source"] = "raw.historical_prices"
    return result
