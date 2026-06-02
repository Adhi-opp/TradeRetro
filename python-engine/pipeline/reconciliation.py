"""
Self-healing reconciliation — patch silver 1-min gaps from Upstox REST.

The dropped-tick problem: if the WebSocket disconnects mid-session (say a
15-second drop during a Bank Nifty spike), bronze.market_ticks is missing
those ticks, so the silver aggregator can never build the affected 1-minute
bars — there's simply no data to aggregate. The warehouse silently loses a
slice of the session.

This module closes that hole:
    1. detect_gaps  — find 1-min buckets that SHOULD exist (market open, past a
                      grace period) but don't, per instrument.
    2. Upstox REST  — fetch the authoritative 1-min candles for today.
    3. patch_silver — UPSERT the missing buckets, tagged source='reconciled',
                      ON CONFLICT DO NOTHING so real stream bars are never
                      clobbered.

The detector and grid logic are pure functions (unit-tested without a DB or a
live feed); only the fetch + patch touch the outside world.
"""

import asyncio
import logging
from datetime import datetime, time, timedelta

from pipeline.market_hours import IST, is_market_open, is_trading_day, now_ist
from services.db import get_pool
from services.upstox_history import fetch_intraday_1min

logger = logging.getLogger("traderetro.reconciliation")

MARKET_OPEN = time(9, 15)
MARKET_CLOSE = time(15, 30)

# A "gap" must be older than this — younger missing buckets may just be the
# silver aggregator (60s cadence, 5-min window) not having caught up yet.
GRACE_MINUTES = 5

# How often the background loop checks for gaps during market hours.
RECONCILE_INTERVAL_SECONDS = 180


# ── Pure helpers (unit-tested) ───────────────────────────────────────────────

def minute_grid(start_dt: datetime, end_dt: datetime) -> list[datetime]:
    """Minute-aligned datetimes in [start_dt, end_dt) stepping 1 minute."""
    grid = []
    t = start_dt.replace(second=0, microsecond=0)
    while t < end_dt:
        grid.append(t)
        t += timedelta(minutes=1)
    return grid


def find_gaps(present: set[datetime], expected: list[datetime]) -> list[dict]:
    """
    Group expected buckets missing from `present` into contiguous windows.

    Returns [{from, to, minutes}] where from/to are the first/last missing
    minute of each run. Aware datetimes compare by instant, so present/expected
    just need to be minute-aligned in the same timezone.
    """
    windows: list[dict] = []
    run_start = None
    run_end = None

    for t in expected:
        if t in present:
            if run_start is not None:
                windows.append(_window(run_start, run_end))
                run_start = None
            continue
        if run_start is None:
            run_start = t
        run_end = t

    if run_start is not None:
        windows.append(_window(run_start, run_end))
    return windows


def _window(start: datetime, end: datetime) -> dict:
    return {"from": start, "to": end, "minutes": int((end - start).total_seconds() // 60) + 1}


def session_bounds(day, cutoff: datetime | None = None) -> tuple[datetime, datetime]:
    """
    Market-hours window for a trading day, clipped to (cutoff - grace) so we
    never flag buckets the aggregator might still fill.
    """
    start_dt = datetime.combine(day, MARKET_OPEN, tzinfo=IST)
    end_dt = datetime.combine(day, MARKET_CLOSE, tzinfo=IST)
    if cutoff is not None:
        horizon = cutoff.astimezone(IST).replace(second=0, microsecond=0) - timedelta(minutes=GRACE_MINUTES)
        end_dt = min(end_dt, horizon)
    return start_dt, end_dt


# ── DB-backed detection + patch ──────────────────────────────────────────────

async def _present_buckets(conn, instrument_key: str, start_dt: datetime, end_dt: datetime) -> set[datetime]:
    rows = await conn.fetch(
        "SELECT bucket FROM silver.ohlcv_1min "
        "WHERE instrument_key = $1 AND bucket >= $2 AND bucket < $3",
        instrument_key, start_dt, end_dt,
    )
    return {r["bucket"].astimezone(IST).replace(second=0, microsecond=0) for r in rows}


async def detect_gaps(conn, instrument_key: str, day=None, cutoff: datetime | None = None) -> list[dict]:
    """Find missing 1-min buckets for one instrument on a trading day."""
    if day is None:
        day = now_ist().date()
    if cutoff is None:
        cutoff = now_ist()
    start_dt, end_dt = session_bounds(day, cutoff)
    if end_dt <= start_dt:
        return []
    expected = minute_grid(start_dt, end_dt)
    present = await _present_buckets(conn, instrument_key, start_dt, end_dt)
    return find_gaps(present, expected)


_PATCH_SQL = """
INSERT INTO silver.ohlcv_1min
    (instrument_key, bucket, open, high, low, close, volume, trade_count, quality_score, source)
VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 90, 'reconciled')
ON CONFLICT (instrument_key, bucket) DO NOTHING
"""


async def patch_silver(conn, instrument_key: str, bars: list[dict], start_dt: datetime, end_dt: datetime) -> int:
    """
    UPSERT reconciled bars within the session window. ON CONFLICT DO NOTHING
    guarantees we only fill genuine holes and never overwrite stream data.
    Returns the number of rows actually inserted.
    """
    rows = [
        (instrument_key, b["bucket"], b["open"], b["high"], b["low"], b["close"], b["volume"])
        for b in bars
        if start_dt <= b["bucket"].astimezone(IST).replace(second=0, microsecond=0) < end_dt
    ]
    if not rows:
        return 0
    # Count inserted via before/after — executemany doesn't return per-row status.
    before = await conn.fetchval(
        "SELECT count(*) FROM silver.ohlcv_1min WHERE instrument_key = $1 AND bucket >= $2 AND bucket < $3",
        instrument_key, start_dt, end_dt,
    )
    await conn.executemany(_PATCH_SQL, rows)
    after = await conn.fetchval(
        "SELECT count(*) FROM silver.ohlcv_1min WHERE instrument_key = $1 AND bucket >= $2 AND bucket < $3",
        instrument_key, start_dt, end_dt,
    )
    return int(after - before)


async def reconcile_instrument(conn, instrument_key: str, day=None) -> dict:
    """Detect gaps for one instrument and patch them from Upstox REST."""
    if day is None:
        day = now_ist().date()
    cutoff = now_ist()
    start_dt, end_dt = session_bounds(day, cutoff)

    gaps = await detect_gaps(conn, instrument_key, day, cutoff)
    missing_minutes = sum(g["minutes"] for g in gaps)
    if not gaps:
        return {"instrument_key": instrument_key, "gaps": 0, "missing_minutes": 0, "patched": 0}

    logger.info("Reconcile %s: %d gap window(s), %d missing min — fetching REST",
                instrument_key, len(gaps), missing_minutes)
    try:
        bars = await fetch_intraday_1min(instrument_key)
    except Exception as exc:
        logger.warning("Reconcile %s: REST fetch failed: %s", instrument_key, exc)
        return {"instrument_key": instrument_key, "gaps": len(gaps),
                "missing_minutes": missing_minutes, "patched": 0, "error": str(exc)}

    patched = await patch_silver(conn, instrument_key, bars, start_dt, end_dt)
    logger.info("Reconcile %s: patched %d/%d missing bars", instrument_key, patched, missing_minutes)
    return {"instrument_key": instrument_key, "gaps": len(gaps),
            "missing_minutes": missing_minutes, "patched": patched}


async def tracked_instruments(conn, day=None) -> list[str]:
    """Instruments that have at least one silver bar today (what we stream)."""
    if day is None:
        day = now_ist().date()
    start_dt, _ = session_bounds(day)
    rows = await conn.fetch(
        "SELECT DISTINCT instrument_key FROM silver.ohlcv_1min WHERE bucket >= $1",
        start_dt,
    )
    return [r["instrument_key"] for r in rows]


async def reconcile_all(instrument_keys: list[str] | None = None, day=None) -> dict:
    """Reconcile every tracked instrument; returns a per-instrument summary."""
    if day is None:
        day = now_ist().date()
    if not is_trading_day(day):
        return {"status": "skipped", "reason": "not a trading day", "results": []}

    pool = get_pool()
    async with pool.acquire() as conn:
        keys = instrument_keys or await tracked_instruments(conn, day)
        results = []
        for key in keys:
            try:
                results.append(await reconcile_instrument(conn, key, day))
            except Exception as exc:
                logger.error("Reconcile %s failed: %s", key, exc)
                results.append({"instrument_key": key, "error": str(exc)})

    total_patched = sum(r.get("patched", 0) for r in results)
    total_gaps = sum(r.get("gaps", 0) for r in results)
    return {
        "status": "ok",
        "day": str(day),
        "instruments": len(results),
        "total_gaps": total_gaps,
        "total_patched": total_patched,
        "results": results,
    }


async def run_reconciler_loop() -> None:
    """
    Background loop (pipeline-worker, live mode): every RECONCILE_INTERVAL during
    market hours, heal any silver gaps. No-ops cleanly outside market hours or
    when unauthenticated.
    """
    logger.info("Reconciler loop started: every %ds during market hours", RECONCILE_INTERVAL_SECONDS)
    while True:
        await asyncio.sleep(RECONCILE_INTERVAL_SECONDS)
        if not is_market_open():
            continue
        try:
            summary = await reconcile_all()
            if summary.get("total_patched"):
                logger.info("Reconciler: healed %d bars across %d instruments",
                            summary["total_patched"], summary["instruments"])
        except Exception as exc:
            logger.error("Reconciler pass failed: %s", exc)
