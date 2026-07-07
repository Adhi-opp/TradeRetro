"""
Live Market Router
==================
Endpoints feeding the Cross-Asset Monitor. These read from
raw.historical_prices (EOD close) until the Upstox WebSocket pipeline
is flowing - at which point the quote endpoint will prefer Redis.

    GET /api/live/quotes          - latest close + prev close + pct change for a symbol list
    GET /api/live/prices/{symbol} - close price series for a lookback window (chart)
    GET /api/live/vix             - current India VIX + regime band
    GET /api/live/signals         - computed macro signal feed
"""

import logging
from datetime import date, datetime

from fastapi import APIRouter, HTTPException, Query

from services.db import get_pool
from services.redis_client import latest_quotes
from services.ticker_resolver import normalize

logger = logging.getLogger("traderetro.live")

router = APIRouter(prefix="/api/live", tags=["live"])

# Warehouse uses yfinance-style suffixes ("NIFTY50.NS"); the Upstox WebSocket
# producer publishes the short form ("NIFTY50"). Map between them when
# checking Redis for fresh ticks.
_WAREHOUSE_TO_LIVE = {
    "NIFTY50.NS": "NIFTY50",
    "BANKNIFTY.NS": "BANKNIFTY",
    "INDIAVIX": "INDIAVIX",
}

LIVE_TICK_MAX_AGE_SECONDS = 60.0  # ticks older than this fall back to EOD


def _warehouse_to_live_symbol(key: str) -> str:
    """Convert warehouse ticker to the symbol used in Redis market:latest."""
    if key in _WAREHOUSE_TO_LIVE:
        return _WAREHOUSE_TO_LIVE[key]
    if key.endswith(".NS"):
        return key[:-3]
    return key


def _parse_tick_age(timestamp_str: str | None) -> float | None:
    """Return tick age in seconds, or None if unparseable."""
    if not timestamp_str:
        return None
    try:
        ts = datetime.fromisoformat(timestamp_str)
    except (ValueError, TypeError):
        return None
    now = datetime.now(ts.tzinfo) if ts.tzinfo else datetime.now()
    return max(0.0, (now - ts).total_seconds())


# ── VIX regime bands (India VIX historical ranges) ──────────────
def _vix_regime(vix: float) -> tuple[str, str, str]:
    """Return (regime_label, regime_code, advice)."""
    if vix < 13:
        return "Low Volatility", "low", "Theta selling favorable"
    if vix < 20:
        return "Normal", "normal", "Standard execution"
    if vix < 28:
        return "Elevated", "elevated", "Reduce size, widen stops"
    return "High Risk", "high", "Spreads only, halve size"


@router.get("/quotes")
async def quotes(symbols: list[str] = Query(...)):
    """
    Latest close + prev close for each symbol.

    Resolution order per symbol:
      1. Fresh Redis tick (< 60s old, from Upstox WS or simulator) → live LTP
         with prev close from EOD warehouse.
      2. Latest EOD close in raw.historical_prices → stale, flagged with
         stale_days.

    Returns:
        [{symbol, display_name, asset_class, last, prev_close, change_pct,
          as_of, source, stale_days, tick_age_seconds}]
    """
    keys = [normalize(s) for s in symbols]

    pool = get_pool()
    async with pool.acquire() as conn:
        # Latest + prev close per ticker (EOD baseline)
        rows = await conn.fetch(
            """
            WITH ranked AS (
                SELECT ticker, trade_date, close_price,
                       ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY trade_date DESC) AS rn
                FROM raw.historical_prices
                WHERE ticker = ANY($1::text[])
            )
            SELECT ticker, trade_date, close_price, rn
            FROM ranked
            WHERE rn <= 2
            ORDER BY ticker, rn
            """,
            keys,
        )
        meta_rows = await conn.fetch(
            "SELECT symbol, display_name, asset_class FROM ops.user_universe "
            "WHERE symbol = ANY($1::text[])",
            keys,
        )

    # Fetch live ticks in one HMGET round-trip
    live_symbol_for = {k: _warehouse_to_live_symbol(k) for k in keys}
    live_lookup_keys = list(set(live_symbol_for.values()))
    live_map = await latest_quotes(live_lookup_keys)

    meta = {r["symbol"]: r for r in meta_rows}
    by_ticker: dict[str, list] = {}
    for r in rows:
        by_ticker.setdefault(r["ticker"], []).append(r)

    today = date.today()
    results = []
    has_live = False

    for key in keys:
        entries = by_ticker.get(key, [])
        m = meta.get(key)
        display_name = m["display_name"] if m else key
        asset_class = m["asset_class"] if m else "equity"

        # EOD baseline for prev close
        latest_eod = entries[0] if entries else None
        prev_eod = entries[1] if len(entries) > 1 else None

        # Try fresh live tick first
        live_sym = live_symbol_for[key]
        live_tick = live_map.get(live_sym)
        tick_age = _parse_tick_age(live_tick.get("timestamp")) if live_tick else None
        is_fresh = (
            live_tick is not None
            and tick_age is not None
            and tick_age <= LIVE_TICK_MAX_AGE_SECONDS
        )

        if is_fresh:
            try:
                last = float(live_tick["ltp"])
            except (KeyError, TypeError, ValueError):
                is_fresh = False

        if is_fresh:
            # For live tick, prev close = most recent EOD close (if any)
            prev_close = float(latest_eod["close_price"]) if latest_eod else last
            change_pct = ((last - prev_close) / prev_close * 100.0) if prev_close else 0.0
            has_live = True
            results.append({
                "symbol": key,
                "display_name": display_name,
                "asset_class": asset_class,
                "last": round(last, 4),
                "prev_close": round(prev_close, 4),
                "change_pct": round(change_pct, 3),
                "as_of": live_tick.get("timestamp"),
                "source": live_tick.get("source", "redis"),
                "stale_days": 0,
                "tick_age_seconds": round(tick_age, 1) if tick_age is not None else None,
            })
            continue

        # Fall back to EOD
        if not latest_eod:
            results.append({
                "symbol": key,
                "display_name": display_name,
                "asset_class": asset_class,
                "last": None,
                "prev_close": None,
                "change_pct": None,
                "as_of": None,
                "source": "none",
                "stale_days": None,
                "tick_age_seconds": None,
            })
            continue

        last = float(latest_eod["close_price"])
        prev_close = float(prev_eod["close_price"]) if prev_eod else last
        change_pct = ((last - prev_close) / prev_close * 100.0) if prev_close else 0.0
        stale = (today - latest_eod["trade_date"]).days
        results.append({
            "symbol": key,
            "display_name": display_name,
            "asset_class": asset_class,
            "last": round(last, 4),
            "prev_close": round(prev_close, 4),
            "change_pct": round(change_pct, 3),
            "as_of": latest_eod["trade_date"].isoformat(),
            "source": "eod",
            "stale_days": stale,
            "tick_age_seconds": None,
        })

    return {
        "quotes": results,
        "source": "mixed" if has_live else "raw.historical_prices",
    }


@router.get("/prices/{symbol}")
async def prices(symbol: str, lookback_days: int = Query(60, ge=2, le=750)):
    """
    Close price series for the last `lookback_days` observations.

    If a fresh live tick exists for this symbol and the EOD warehouse has no
    bar for today yet, append the live LTP as today's point so the chart
    visibly extends through the current trading day instead of stopping at
    yesterday's close.
    """
    key = normalize(symbol)
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT trade_date, close_price
            FROM raw.historical_prices
            WHERE ticker = $1
            ORDER BY trade_date DESC
            LIMIT $2
            """,
            key, lookback_days,
        )
    if not rows:
        raise HTTPException(status_code=404, detail=f"no data for '{key}' in warehouse")

    points = [{"date": r["trade_date"].isoformat(), "close": float(r["close_price"])}
              for r in reversed(rows)]
    last_eod_date = rows[0]["trade_date"]

    # Append today's live LTP if EOD hasn't ingested today yet.
    live_appended = False
    today = date.today()
    if last_eod_date < today:
        live_sym = _warehouse_to_live_symbol(key)
        live_map = await latest_quotes([live_sym])
        live_tick = live_map.get(live_sym)
        tick_age = _parse_tick_age(live_tick.get("timestamp")) if live_tick else None
        if (
            live_tick is not None
            and tick_age is not None
            and tick_age <= LIVE_TICK_MAX_AGE_SECONDS
        ):
            try:
                ltp = float(live_tick["ltp"])
                points.append({
                    "date": today.isoformat(),
                    "close": ltp,
                    "live": True,
                })
                live_appended = True
            except (KeyError, TypeError, ValueError):
                pass

    return {
        "symbol": key,
        "lookback_days": lookback_days,
        "points": points,
        "as_of": points[-1]["date"],
        "live_tail": live_appended,
    }


@router.get("/vix")
async def india_vix():
    """
    Current India VIX + regime band.

    Prefers a fresh Redis tick (< 60s old) for the live VIX level, with
    prev close pulled from raw.historical_prices. Falls back to EOD-only
    when no recent tick is available.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT trade_date, close_price FROM raw.historical_prices "
            "WHERE ticker = 'INDIAVIX' ORDER BY trade_date DESC LIMIT 1"
        )
        prev = await conn.fetchrow(
            "SELECT close_price FROM raw.historical_prices "
            "WHERE ticker = 'INDIAVIX' ORDER BY trade_date DESC OFFSET 1 LIMIT 1"
        )

    # Try fresh live tick first (live INDIAVIX from Upstox V3 or simulator)
    live_map = await latest_quotes(["INDIAVIX"])
    live_tick = live_map.get("INDIAVIX")
    tick_age = _parse_tick_age(live_tick.get("timestamp")) if live_tick else None
    is_fresh = (
        live_tick is not None
        and tick_age is not None
        and tick_age <= LIVE_TICK_MAX_AGE_SECONDS
    )

    if is_fresh:
        try:
            vix = float(live_tick["ltp"])
        except (KeyError, TypeError, ValueError):
            is_fresh = False

    if is_fresh:
        # prev close: most recent EOD (yesterday's close) if available
        prev_vix = float(row["close_price"]) if row else vix
        regime, code, advice = _vix_regime(vix)
        return {
            "status": "ok",
            "vix": round(vix, 2),
            "prev_vix": round(prev_vix, 2),
            "change_pct": round((vix - prev_vix) / prev_vix * 100, 2) if prev_vix else 0.0,
            "regime": regime,
            "regime_code": code,
            "advice": advice,
            "as_of": live_tick.get("timestamp"),
            "source": live_tick.get("source", "redis"),
            "tick_age_seconds": round(tick_age, 1) if tick_age is not None else None,
        }

    # EOD fallback
    if not row:
        return {
            "status": "no_data",
            "reason": "INDIAVIX not backfilled - POST /api/universe with symbol=INDIAVIX",
        }

    vix = float(row["close_price"])
    prev_vix = float(prev["close_price"]) if prev else vix
    regime, code, advice = _vix_regime(vix)
    return {
        "status": "ok",
        "vix": round(vix, 2),
        "prev_vix": round(prev_vix, 2),
        "change_pct": round((vix - prev_vix) / prev_vix * 100, 2) if prev_vix else 0.0,
        "regime": regime,
        "regime_code": code,
        "advice": advice,
        "as_of": row["trade_date"].isoformat(),
        "source": "eod",
        "tick_age_seconds": None,
    }


@router.get("/signals")
async def macro_signals(
    base: str = Query("NIFTY50.NS"),
    peers: list[str] = Query(default=["RELIANCE.NS", "USDINR", "CRUDE"]),
):
    """
    Compute a live macro signal feed from the latest EOD moves.

    Signals emitted:
      - heavyweight divergence (base move vs peer move > 0.3%)
      - USD/INR spike (|day-change| > 0.15%)
      - VIX regime alert (elevated or high)
      - base selloff + USD strengthening (macro risk-off combo)
    """
    # Reuse the /quotes endpoint logic
    all_keys = [normalize(base)] + [normalize(p) for p in peers]
    if "INDIAVIX" not in all_keys:
        all_keys.append("INDIAVIX")
    q = await quotes(all_keys)
    quote_map = {r["symbol"]: r for r in q["quotes"]}
    b = quote_map.get(normalize(base))

    signals = []
    if not b or b["change_pct"] is None:
        return {"signals": [], "reason": "base ticker has no data"}

    base_chg = b["change_pct"]
    as_of = b["as_of"]

    # Heavyweight divergence
    for p in peers:
        pk = normalize(p)
        pq = quote_map.get(pk)
        if not pq or pq["change_pct"] is None or pk == normalize(base):
            continue
        div = base_chg - pq["change_pct"]
        if abs(div) > 0.3 and pk not in {"USDINR", "CRUDE", "INDIAVIX"}:
            signals.append({
                "severity": "warning" if div > 0 else "bull",
                "title": f"{pq['display_name']} diverging from {b['display_name']} ({div:+.2f}%)",
                "desc": ("Index up but peer lagging - possible bull trap."
                         if div > 0 else
                         "Index down but peer holding - latent strength."),
                "as_of": as_of,
            })

    # USD/INR spike
    usd = quote_map.get("USDINR")
    if usd and usd["change_pct"] is not None and abs(usd["change_pct"]) > 0.15:
        sign = "strengthening" if usd["change_pct"] < 0 else "weakening"
        signals.append({
            "severity": "warning",
            "title": f"INR {sign} sharply ({usd['change_pct']:+.2f}%)",
            "desc": ("RBI intervention likely. Expect short-covering in equities."
                     if usd["change_pct"] < 0 else
                     "FII outflow pressure. Watch for equity weakness."),
            "as_of": usd["as_of"],
        })

    # VIX regime
    vix_q = quote_map.get("INDIAVIX")
    if vix_q and vix_q["last"] is not None:
        regime, code, advice = _vix_regime(vix_q["last"])
        if code in {"elevated", "high"}:
            signals.append({
                "severity": "bear" if code == "high" else "warning",
                "title": f"India VIX at {vix_q['last']:.1f} - {regime}",
                "desc": advice,
                "as_of": vix_q["as_of"],
            })

    # Macro risk-off combo
    if base_chg < -0.4 and usd and usd["change_pct"] and usd["change_pct"] > 0.2:
        signals.append({
            "severity": "bear",
            "title": "Risk-off macro signal (equities down + INR weakening)",
            "desc": "Classic FII exit pattern. Supports deep-ITM index puts on confirmation.",
            "as_of": as_of,
        })

    if not signals:
        signals.append({
            "severity": "neutral",
            "title": "Cross-asset correlations normal",
            "desc": "No divergence or regime alerts detected at current EOD close.",
            "as_of": as_of,
        })

    return {"signals": signals, "base": b["symbol"], "as_of": as_of}
