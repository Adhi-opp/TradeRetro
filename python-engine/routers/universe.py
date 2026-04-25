"""
User Ticker Universe Router
===========================
Endpoints for adding / listing / removing tickers from the persisted
universe. Adding a new ticker spawns a yfinance backfill job (2y daily
by default) so the warehouse has data before the frontend tries to use it.

    GET    /api/universe              - list all tickers with coverage stats
    POST   /api/universe              - add a ticker, trigger backfill if needed
    DELETE /api/universe/{symbol}     - remove from universe (data retained)
    GET    /api/universe/resolve      - normalize + validate a free-text input
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.db import get_pool
from services.ticker_resolver import resolve, normalize

logger = logging.getLogger("traderetro.universe")

router = APIRouter(prefix="/api/universe", tags=["universe"])


class AddTickerRequest(BaseModel):
    symbol: str
    period: str = "2y"


async def _coverage_stats(symbol: str) -> dict:
    """Fetch row count and date range for a symbol from raw.historical_prices."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT COUNT(*) AS n, MIN(trade_date) AS earliest, MAX(trade_date) AS latest "
            "FROM raw.historical_prices WHERE ticker = $1",
            symbol,
        )
    return {
        "row_count": int(row["n"] or 0),
        "earliest_date": row["earliest"].isoformat() if row["earliest"] else None,
        "latest_date": row["latest"].isoformat() if row["latest"] else None,
    }


@router.get("")
async def list_universe():
    """
    Return all tickers in the user universe with live coverage stats
    (LEFT JOIN against raw.historical_prices for accuracy).
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT u.symbol,
                   u.display_name,
                   u.asset_class,
                   u.added_at,
                   u.last_backfill_at,
                   u.backfill_status,
                   u.backfill_job_id,
                   COALESCE(p.row_count, 0)  AS row_count,
                   p.earliest_date,
                   p.latest_date
            FROM ops.user_universe u
            LEFT JOIN (
                SELECT ticker,
                       COUNT(*)  AS row_count,
                       MIN(trade_date) AS earliest_date,
                       MAX(trade_date) AS latest_date
                FROM raw.historical_prices
                GROUP BY ticker
            ) p ON p.ticker = u.symbol
            ORDER BY u.asset_class, u.symbol
            """
        )

    return [
        {
            "symbol": r["symbol"],
            "display_name": r["display_name"] or r["symbol"],
            "asset_class": r["asset_class"],
            "added_at": r["added_at"].isoformat() if r["added_at"] else None,
            "last_backfill_at": r["last_backfill_at"].isoformat() if r["last_backfill_at"] else None,
            "backfill_status": "completed" if (r["row_count"] or 0) > 0 else r["backfill_status"],
            "backfill_job_id": r["backfill_job_id"],
            "row_count": int(r["row_count"] or 0),
            "earliest_date": r["earliest_date"].isoformat() if r["earliest_date"] else None,
            "latest_date": r["latest_date"].isoformat() if r["latest_date"] else None,
        }
        for r in rows
    ]


@router.get("/resolve")
async def resolve_ticker(q: str = Query(..., min_length=1)):
    """Normalize + validate a free-text ticker. Used for autocomplete."""
    try:
        r = await resolve(q, probe_metadata=True)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "symbol": r.symbol,
        "yahoo_symbol": r.yahoo_symbol,
        "display_name": r.display_name,
        "asset_class": r.asset_class,
    }


@router.post("")
async def add_ticker(body: AddTickerRequest):
    """
    Add a ticker to the user universe. If the warehouse has no rows for
    it, trigger an async yfinance backfill and return the job id. The
    frontend can poll /api/ingest/status/{job_id} to follow progress.
    """
    # Late import so the ingestion router's in-memory _flows dict is shared.
    from routers.ingestion import _flows
    from flows.historical_backfill import historical_backfill

    try:
        resolved = await resolve(body.symbol, probe_metadata=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    stats = await _coverage_stats(resolved.symbol)

    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO ops.user_universe
                (symbol, display_name, asset_class, backfill_status, row_count,
                 earliest_date, latest_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (symbol) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                asset_class  = EXCLUDED.asset_class
            """,
            resolved.symbol, resolved.display_name, resolved.asset_class,
            "completed" if stats["row_count"] > 0 else "pending",
            stats["row_count"],
            stats["earliest_date"] and datetime.fromisoformat(stats["earliest_date"]).date(),
            stats["latest_date"] and datetime.fromisoformat(stats["latest_date"]).date(),
        )

    if stats["row_count"] > 0:
        return {
            "symbol": resolved.symbol,
            "display_name": resolved.display_name,
            "asset_class": resolved.asset_class,
            "backfill_status": "completed",
            "row_count": stats["row_count"],
            "earliest_date": stats["earliest_date"],
            "latest_date": stats["latest_date"],
            "job_id": None,
            "message": "already backfilled",
        }

    # Trigger a backfill job via the same in-memory tracker the ingestion router uses
    job_id = f"backfill-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{resolved.symbol}"
    _flows[job_id] = {
        "flow_id": job_id,
        "type": "backfill",
        "status": "running",
        "started_at": datetime.now().isoformat(),
        "tickers": [resolved.symbol],
        "period": body.period,
    }

    async def _run():
        try:
            result = await historical_backfill([resolved.symbol], body.period)
            _flows[job_id]["status"] = "completed"
            _flows[job_id]["result"] = result

            # Refresh coverage in user_universe after backfill finishes
            fresh = await _coverage_stats(resolved.symbol)
            pool2 = get_pool()
            async with pool2.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE ops.user_universe
                    SET backfill_status = $2,
                        last_backfill_at = CURRENT_TIMESTAMP,
                        backfill_job_id = $3,
                        row_count = $4,
                        earliest_date = $5,
                        latest_date = $6
                    WHERE symbol = $1
                    """,
                    resolved.symbol,
                    "completed" if fresh["row_count"] > 0 else "failed",
                    job_id,
                    fresh["row_count"],
                    fresh["earliest_date"] and datetime.fromisoformat(fresh["earliest_date"]).date(),
                    fresh["latest_date"] and datetime.fromisoformat(fresh["latest_date"]).date(),
                )
        except Exception as exc:
            logger.exception("add_ticker backfill failed for %s", resolved.symbol)
            _flows[job_id]["status"] = "failed"
            _flows[job_id]["error"] = str(exc)
            pool2 = get_pool()
            async with pool2.acquire() as conn:
                await conn.execute(
                    "UPDATE ops.user_universe SET backfill_status=$2, backfill_job_id=$3 WHERE symbol=$1",
                    resolved.symbol, "failed", job_id,
                )
        _flows[job_id]["finished_at"] = datetime.now().isoformat()

    asyncio.create_task(_run())

    return {
        "symbol": resolved.symbol,
        "display_name": resolved.display_name,
        "asset_class": resolved.asset_class,
        "backfill_status": "running",
        "row_count": 0,
        "job_id": job_id,
        "period": body.period,
        "message": "backfill triggered",
    }


@router.delete("/{symbol}")
async def remove_ticker(symbol: str):
    """Remove from universe. Warehouse data is retained - only the registry entry is dropped."""
    key = normalize(symbol)
    pool = get_pool()
    async with pool.acquire() as conn:
        res = await conn.execute("DELETE FROM ops.user_universe WHERE symbol = $1", key)
    # asyncpg returns status like 'DELETE 1'
    removed = res.endswith(" 1")
    if not removed:
        raise HTTPException(status_code=404, detail=f"ticker '{key}' not in universe")
    return {"symbol": key, "removed": True}
