"""
Data Quality Router
===================
Read-only endpoints that surface results of the existing quality
checks (pipeline/quality.py) in a single round-trip, so the UI can
show DQ status without triggering a long-running Prefect flow.

    GET /api/quality/audit          — per-ticker audit across the universe
    GET /api/quality/audit/{ticker} — drill into one ticker
"""

import asyncio
import logging
from datetime import date as dt_date

from fastapi import APIRouter, Query

from pipeline.quality import (
    run_quality_checks,
    run_gap_detection,
    run_staleness_check,
)
from services.db import get_pool

logger = logging.getLogger("traderetro.quality")
router = APIRouter(prefix="/api/quality", tags=["quality"])


async def _audit_one(ticker: str, recent_only: bool) -> dict:
    """Run all three checks for one ticker and collapse into a flat summary."""
    dq = await run_quality_checks(ticker, only_recent=recent_only)
    gaps = await run_gap_detection(ticker)
    staleness = await run_staleness_check(ticker)

    hard_count = len(dq["hard_failures"])
    soft_count = len(dq["soft_warnings"])
    gap_count = gaps["gap_count"]
    is_stale = staleness["stale"]

    # Severity rollup: hard fail > stale > gaps > soft warnings > clean
    if hard_count > 0:
        severity = "critical"
    elif is_stale or gap_count > 5:
        severity = "warning"
    elif soft_count > 0 or gap_count > 0:
        severity = "info"
    else:
        severity = "ok"

    return {
        "ticker": ticker,
        "severity": severity,
        "rows_checked": dq["rows_checked"],
        "hard_failures": dq["hard_failures"],
        "soft_warnings": dq["soft_warnings"],
        "gap_count": gap_count,
        "gap_sample": gaps["gaps"][:5],
        "stale": is_stale,
        "days_behind": staleness["days_behind"],
        "latest_date": staleness["latest_date"],
    }


@router.get("/audit")
async def audit_all(recent: bool = Query(True, description="Restrict to recent rows for speed")):
    """
    Run quality checks across every ticker in raw.historical_prices.
    Returns a summary + per-ticker breakdown sorted by severity.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT DISTINCT ticker FROM raw.historical_prices ORDER BY ticker"
        )
    tickers = [r["ticker"] for r in rows]

    # Run audits concurrently — they're independent and just hit the DB
    audits = await asyncio.gather(
        *(_audit_one(t, recent_only=recent) for t in tickers),
        return_exceptions=True,
    )
    results = []
    for ticker, audit in zip(tickers, audits):
        if isinstance(audit, Exception):
            logger.warning("Quality audit failed for %s: %s", ticker, audit)
            results.append({"ticker": ticker, "severity": "error", "error": str(audit)})
        else:
            results.append(audit)

    # Sort: critical → warning → info → ok
    order = {"critical": 0, "error": 1, "warning": 2, "info": 3, "ok": 4}
    results.sort(key=lambda r: order.get(r["severity"], 99))

    counts = {sev: sum(1 for r in results if r["severity"] == sev)
              for sev in ("critical", "error", "warning", "info", "ok")}

    return {
        "summary": {
            "total_tickers": len(results),
            "critical": counts["critical"],
            "warnings": counts["warning"],
            "info": counts["info"],
            "ok": counts["ok"],
            "errored": counts["error"],
        },
        "results": results,
        "checked_at": dt_date.today().isoformat(),
        "scope": "recent" if recent else "full_history",
    }


@router.get("/audit/{ticker}")
async def audit_one_ticker(ticker: str, recent: bool = Query(False)):
    """Drill-down audit for a single ticker (full history by default)."""
    return await _audit_one(ticker, recent_only=recent)
