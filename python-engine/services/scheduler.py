"""
Lightweight async scheduler — runs the EOD pipeline daily at 16:00 IST
on NSE trading days (Mon-Fri). Lives in the FastAPI container's lifespan
so there's nothing extra to deploy.

This is intentionally simpler than a Prefect deployment + worker pool.
The Prefect-decorated `eod_pipeline` flow still runs (so Prefect UI sees
the run); we just trigger it from an asyncio task instead of from a
Prefect scheduler.
"""

import asyncio
import logging
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

logger = logging.getLogger("traderetro.scheduler")

IST = ZoneInfo("Asia/Kolkata")
EOD_TIME_IST = time(hour=16, minute=0)  # 30 min after market close


def _next_eod_run(now_ist: datetime) -> datetime:
    """Return the next Mon-Fri 16:00 IST after `now_ist`."""
    target = datetime.combine(now_ist.date(), EOD_TIME_IST, tzinfo=IST)
    if target <= now_ist:
        target += timedelta(days=1)
    # Skip Sat (5) and Sun (6)
    while target.weekday() >= 5:
        target += timedelta(days=1)
    return target


def _last_expected_eod_date(now_ist: datetime) -> date:
    """Most recent weekday whose 16:00 IST EOD slot has already passed."""
    d = now_ist.date()
    if now_ist.timetz().replace(tzinfo=None) < EOD_TIME_IST:
        d -= timedelta(days=1)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


async def _catch_up_if_stale() -> None:
    """
    On startup, run EOD immediately if the warehouse missed its last slot.

    The fixed 16:00 IST slot only fires while the container is running —
    on a machine that isn't always on, the warehouse silently goes stale.
    The EOD flow is watermark-driven and idempotent, so a catch-up run
    backfills every missed day in one shot.
    """
    from services.db import get_pool

    try:
        pool = get_pool()
        watermark = await pool.fetchval(
            "SELECT MAX(trade_date) FROM raw.historical_prices"
        )
    except Exception as exc:
        logger.warning("Catch-up check skipped (DB not ready): %s", exc)
        return

    if watermark is None:
        logger.info("Catch-up check: warehouse empty — leaving backfill to the user")
        return

    expected = _last_expected_eod_date(datetime.now(IST))
    if watermark >= expected:
        logger.info("Catch-up check: warehouse fresh (watermark %s)", watermark)
        return

    logger.info(
        "Catch-up: warehouse stale (watermark %s < expected %s) — running EOD now",
        watermark, expected,
    )
    await _run_eod_once()


async def _run_eod_once() -> None:
    """Invoke the Prefect flow directly (no deployment needed)."""
    from flows.eod_pipeline import eod_pipeline
    try:
        result = await eod_pipeline()
        success = len(result.get("success", []))
        failed = len(result.get("failed", []))
        logger.info("Scheduled EOD complete: %d success, %d failed", success, failed)
    except Exception as exc:
        logger.error("Scheduled EOD failed: %s", exc)


async def run_eod_scheduler() -> None:
    """
    Forever loop: sleep until next 16:00 IST weekday, run EOD, repeat.
    Survives transient failures by recomputing the next slot.
    """
    logger.info("EOD scheduler started — target: 16:00 IST on weekdays")

    # Give the lifespan a moment to finish pool init, then heal staleness
    # from any missed slots while the container was down.
    await asyncio.sleep(15)
    await _catch_up_if_stale()

    while True:
        now = datetime.now(IST)
        next_run = _next_eod_run(now)
        wait_seconds = (next_run - now).total_seconds()
        logger.info(
            "Next EOD run at %s IST (%.1fh away)",
            next_run.strftime("%a %Y-%m-%d %H:%M"),
            wait_seconds / 3600,
        )

        # Sleep in 1-hour chunks so a container restart picks up shortly
        # rather than waiting out a stale multi-hour sleep.
        while wait_seconds > 0:
            chunk = min(wait_seconds, 3600)
            await asyncio.sleep(chunk)
            now = datetime.now(IST)
            wait_seconds = (next_run - now).total_seconds()

        await _run_eod_once()
