"""
Quality Audit — Prefect Flow
=============================
Scheduled quality audit across all tracked tickers.
Runs gap detection, staleness checks, and OHLCV integrity validation.

Usage:
    POST /api/ingest/quality-audit {"tickers": [...]}
"""

from prefect import flow, task, get_run_logger

from pipeline.quality import run_quality_checks, run_gap_detection, run_staleness_check
from flows.eod_pipeline import ensure_connections, emit_metric, DEFAULT_TICKERS


@task
async def audit_ticker(ticker: str) -> dict:
    """Run full quality audit for a single ticker."""
    log = get_run_logger()

    dq = await run_quality_checks(ticker, only_recent=False)
    gaps = await run_gap_detection(ticker)
    staleness = await run_staleness_check(ticker)

    result = {
        "ticker": ticker,
        "quality": dq,
        "gaps": gaps,
        "staleness": staleness,
    }

    issues = []
    if dq["hard_fail"]:
        issues.append(f"HARD FAIL: {len(dq['hard_failures'])} checks")
    if dq["soft_warnings"]:
        issues.append(f"{len(dq['soft_warnings'])} warnings")
    if gaps["gap_count"] > 0:
        issues.append(f"{gaps['gap_count']} date gaps")
    if staleness["stale"]:
        issues.append(f"stale ({staleness['days_behind']}d behind)")

    if issues:
        log.warning("%s: %s", ticker, ", ".join(issues))
    else:
        log.info("%s: all checks passed", ticker)

    return result


@flow(name="quality-audit", log_prints=True)
async def quality_audit(tickers: list[str] | None = None):
    """Run quality audit across all tracked tickers."""
    await ensure_connections()
    log = get_run_logger()

    tickers = tickers or DEFAULT_TICKERS
    log.info("Quality audit starting for %d tickers", len(tickers))

    results = {}
    for ticker in tickers:
        try:
            results[ticker] = await audit_ticker(ticker)
        except Exception as exc:
            log.error("Audit failed for %s: %s", ticker, exc)
            results[ticker] = {"ticker": ticker, "error": str(exc)}

    hard_fails = sum(1 for r in results.values() if r.get("quality", {}).get("hard_fail"))
    stale_count = sum(1 for r in results.values() if r.get("staleness", {}).get("stale"))
    total_gaps = sum(r.get("gaps", {}).get("gap_count", 0) for r in results.values())

    await emit_metric("quality_audit_hard_fails", float(hard_fails))
    await emit_metric("quality_audit_stale_tickers", float(stale_count))
    await emit_metric("quality_audit_total_gaps", float(total_gaps))

    log.info(
        "Audit complete: %d hard fails, %d stale, %d gaps",
        hard_fails, stale_count, total_gaps,
    )
    return results
