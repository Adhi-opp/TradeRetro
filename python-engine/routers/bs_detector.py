"""
BS Detector Router
==================
POST /api/verify-strategy — verify AI-generated trading strategies against real data.
"""

import traceback
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.db import get_pool
from services.bs_sandbox import build_safe_function
from services.bs_engine import add_indicators, backtest, generate_verdict, AIClaims

router = APIRouter()


class AiClaimsModel(BaseModel):
    win_rate: Optional[float] = None
    total_return: Optional[float] = None
    max_drawdown: Optional[float] = None
    description: Optional[str] = None


class VerifyRequest(BaseModel):
    stock: str
    entry_body: str
    exit_body: str
    ai_claims: Optional[AiClaimsModel] = None


def _normalize_ticker(stock: str) -> str:
    stock = stock.upper()
    return stock if stock.endswith(".NS") else f"{stock}.NS"


async def _load_price_frame(pg_ticker: str) -> pd.DataFrame:
    query = """
        SELECT
            trade_date AS date,
            open_price AS open,
            high_price AS high,
            low_price AS low,
            close_price AS close,
            volume
        FROM raw.historical_prices
        WHERE ticker = $1
        ORDER BY trade_date ASC
    """

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, pg_ticker)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"PostgreSQL unavailable while loading '{pg_ticker}': {exc}",
        ) from exc

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for '{pg_ticker}' in PostgreSQL. Backfill raw.historical_prices first.",
        )

    df = pd.DataFrame([dict(row) for row in rows])
    df["date"] = pd.to_datetime(df["date"])
    df.set_index("date", inplace=True)

    numeric_cols = ["open", "high", "low", "close", "volume"]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["open", "high", "low", "close"]).sort_index()
    if df.empty:
        raise HTTPException(
            status_code=422,
            detail=f"Ticker '{pg_ticker}' has no usable OHLC rows after normalization.",
        )

    df["open"] = df["open"].astype(float)
    df["high"] = df["high"].astype(float)
    df["low"] = df["low"].astype(float)
    df["close"] = df["close"].astype(float)
    df["volume"] = df["volume"].fillna(0).astype("int64")

    return df


@router.post("/api/verify-strategy")
async def verify(req: VerifyRequest):
    stock = req.stock.upper()
    pg_ticker = _normalize_ticker(stock)

    # I/O layer: fetch from PostgreSQL
    df = await _load_price_frame(pg_ticker)
    df = add_indicators(df)

    # Compute layer: compile sandboxed strategy functions
    entry_fn = build_safe_function(req.entry_body, "entry_condition")
    exit_fn = build_safe_function(req.exit_body, "exit_condition")

    # Injection layer: execute only against in-memory rows
    try:
        actual = backtest(df, entry_fn, exit_fn)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Backtest execution error: {e}\n{traceback.format_exc()}",
        )

    # Convert Pydantic model to AIClaims dataclass
    claims = None
    if req.ai_claims:
        claims = AIClaims(
            win_rate=req.ai_claims.win_rate,
            total_return=req.ai_claims.total_return,
            max_drawdown=req.ai_claims.max_drawdown,
            description=req.ai_claims.description,
        )

    verdict = generate_verdict(actual, claims)

    return {
        "stock": stock,
        "actual_results": actual,
        "verdict": verdict,
        "data_range": {
            "start": str(df.index.min().date()) if len(df) > 0 else None,
            "end": str(df.index.max().date()) if len(df) > 0 else None,
            "total_candles": len(df),
        },
        "data_source": {
            "mode": "timescaledb_medallion",
            "ticker": pg_ticker,
        },
    }
