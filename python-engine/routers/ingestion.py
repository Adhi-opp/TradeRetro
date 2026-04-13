"""
Ingestion Router — trigger and monitor data pipeline flows.

Endpoints:
    POST /api/ingest/eod            — trigger EOD pipeline
    POST /api/ingest/backfill       — trigger historical backfill
    POST /api/ingest/quality-audit  — trigger quality audit
    GET  /api/ingest/status/{id}    — check flow status
    GET  /api/ingest/flows          — list recent triggered flows
    GET  /api/ingest/history        — ingestion log from ops.ingestion_log
"""

import asyncio
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.db import get_pool

router = APIRouter(prefix="/api/ingest", tags=["ingestion"])

# In-memory tracker for triggered flows (reset on restart)
_flows: dict[str, dict] = {}


# ── Request models ───────────────────────────────────────────────

class TriggerRequest(BaseModel):
    tickers: list[str] | None = None

class BackfillRequest(BaseModel):
    tickers: list[str] | None = None
    period: str = "10y"


# ── Trigger endpoints ───────────────────────────────────────────

@router.post("/eod")
async def trigger_eod(body: TriggerRequest = TriggerRequest()):
    """Trigger the EOD pipeline for specified tickers (or defaults)."""
    from flows.eod_pipeline import eod_pipeline

    flow_id = f"eod-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    _flows[flow_id] = {
        "flow_id": flow_id,
        "type": "eod",
        "status": "running",
        "started_at": datetime.now().isoformat(),
        "tickers": body.tickers or "defaults",
    }

    async def _run():
        try:
            result = await eod_pipeline(body.tickers)
            _flows[flow_id]["status"] = "completed"
            _flows[flow_id]["result"] = result
        except Exception as exc:
            _flows[flow_id]["status"] = "failed"
            _flows[flow_id]["error"] = str(exc)
        _flows[flow_id]["finished_at"] = datetime.now().isoformat()

    asyncio.create_task(_run())
    return {"flow_id": flow_id, "status": "triggered", "tickers": body.tickers or "defaults"}


@router.post("/backfill")
async def trigger_backfill(body: BackfillRequest = BackfillRequest()):
    """Trigger historical backfill from yfinance."""
    from flows.historical_backfill import historical_backfill

    flow_id = f"backfill-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    _flows[flow_id] = {
        "flow_id": flow_id,
        "type": "backfill",
        "status": "running",
        "started_at": datetime.now().isoformat(),
        "tickers": body.tickers or "defaults",
        "period": body.period,
    }

    async def _run():
        try:
            result = await historical_backfill(body.tickers, body.period)
            _flows[flow_id]["status"] = "completed"
            _flows[flow_id]["result"] = result
        except Exception as exc:
            _flows[flow_id]["status"] = "failed"
            _flows[flow_id]["error"] = str(exc)
        _flows[flow_id]["finished_at"] = datetime.now().isoformat()

    asyncio.create_task(_run())
    return {
        "flow_id": flow_id,
        "status": "triggered",
        "tickers": body.tickers or "defaults",
        "period": body.period,
    }


@router.post("/quality-audit")
async def trigger_quality_audit(body: TriggerRequest = TriggerRequest()):
    """Trigger quality audit across tickers."""
    from flows.quality_check import quality_audit

    flow_id = f"quality-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    _flows[flow_id] = {
        "flow_id": flow_id,
        "type": "quality-audit",
        "status": "running",
        "started_at": datetime.now().isoformat(),
    }

    async def _run():
        try:
            result = await quality_audit(body.tickers)
            _flows[flow_id]["status"] = "completed"
            _flows[flow_id]["result"] = result
        except Exception as exc:
            _flows[flow_id]["status"] = "failed"
            _flows[flow_id]["error"] = str(exc)
        _flows[flow_id]["finished_at"] = datetime.now().isoformat()

    asyncio.create_task(_run())
    return {"flow_id": flow_id, "status": "triggered"}


# ── Status endpoints ─────────────────────────────────────────────

@router.get("/status/{flow_id}")
async def get_flow_status(flow_id: str):
    """Check status of a triggered flow."""
    if flow_id not in _flows:
        raise HTTPException(status_code=404, detail=f"Flow '{flow_id}' not found")
    return _flows[flow_id]


@router.get("/flows")
async def list_flows():
    """List all triggered flows (most recent first)."""
    ordered = sorted(_flows.values(), key=lambda f: f["started_at"], reverse=True)
    return ordered[:50]


@router.get("/history")
async def ingestion_history(limit: int = 50):
    """Get recent entries from ops.ingestion_log."""
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT run_id, ticker, load_type, status, rows_fetched, rows_inserted, "
            "error_message, started_at, finished_at "
            "FROM ops.ingestion_log ORDER BY started_at DESC LIMIT $1",
            limit,
        )

    return [
        {
            "run_id": r["run_id"],
            "ticker": r["ticker"],
            "load_type": r["load_type"],
            "status": r["status"],
            "rows_fetched": r["rows_fetched"],
            "rows_inserted": r["rows_inserted"],
            "error_message": r["error_message"],
            "started_at": r["started_at"].isoformat() if r["started_at"] else None,
            "finished_at": r["finished_at"].isoformat() if r["finished_at"] else None,
        }
        for r in rows
    ]
