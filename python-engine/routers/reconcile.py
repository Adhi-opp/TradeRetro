"""
Reconciliation Router — self-healing silver gaps.

GET  /api/reconcile/gaps  — dry run: which 1-min buckets are missing today
POST /api/reconcile       — detect + patch gaps from Upstox intraday REST
"""

from fastapi import APIRouter, HTTPException

from pipeline.market_hours import now_ist
from pipeline.reconciliation import detect_gaps, reconcile_all, tracked_instruments
from services.db import get_pool

router = APIRouter()


@router.get("/api/reconcile/gaps")
async def gaps():
    """Dry-run gap detection for every tracked instrument (no patching)."""
    day = now_ist().date()
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            keys = await tracked_instruments(conn, day)
            out = []
            for key in keys:
                windows = await detect_gaps(conn, key, day)
                out.append({
                    "instrument_key": key,
                    "gap_windows": len(windows),
                    "missing_minutes": sum(w["minutes"] for w in windows),
                    "gaps": windows,
                })
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Gap detection failed: {exc}") from exc

    return {
        "day": str(day),
        "instruments": len(out),
        "total_missing_minutes": sum(o["missing_minutes"] for o in out),
        "results": out,
    }


@router.post("/api/reconcile")
async def reconcile():
    """Detect gaps and patch them from Upstox intraday candles."""
    try:
        return await reconcile_all()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Reconciliation failed: {exc}") from exc
