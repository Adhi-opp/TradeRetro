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
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from services.db import get_pool
from services.ticker_resolver import normalize

logger = logging.getLogger("traderetro.live")

router = APIRouter(prefix="/api/live", tags=["live"])


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

    Returns:
        [{symbol, display_name, asset_class, last, prev_close, change_pct,
          as_of, stale_days}]
    """
    keys = [normalize(s) for s in symbols]

    pool = get_pool()
    async with pool.acquire() as conn:
        # Pull latest + prev close per ticker using ROW_NUMBER
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
        # Also fetch universe metadata in one hit
        meta_rows = await conn.fetch(
            "SELECT symbol, display_name, asset_class FROM ops.user_universe "
            "WHERE symbol = ANY($1::text[])",
            keys,
        )

    meta = {r["symbol"]: r for r in meta_rows}
    by_ticker: dict[str, list] = {}
    for r in rows:
        by_ticker.setdefault(r["ticker"], []).append(r)

    today = date.today()
    results = []
    for key in keys:
        entries = by_ticker.get(key, [])
        m = meta.get(key)
        if not entries:
            results.append({
                "symbol": key,
                "display_name": m["display_name"] if m else key,
                "asset_class": m["asset_class"] if m else "equity",
                "last": None,
                "prev_close": None,
                "change_pct": None,
                "as_of": None,
                "stale_days": None,
            })
            continue
        latest = entries[0]
        prev = entries[1] if len(entries) > 1 else None
        last = float(latest["close_price"])
        prev_close = float(prev["close_price"]) if prev else last
        change_pct = ((last - prev_close) / prev_close * 100.0) if prev_close else 0.0
        stale = (today - latest["trade_date"]).days
        results.append({
            "symbol": key,
            "display_name": m["display_name"] if m else key,
            "asset_class": m["asset_class"] if m else "equity",
            "last": round(last, 4),
            "prev_close": round(prev_close, 4),
            "change_pct": round(change_pct, 3),
            "as_of": latest["trade_date"].isoformat(),
            "stale_days": stale,
        })

    return {"quotes": results, "source": "raw.historical_prices"}


@router.get("/prices/{symbol}")
async def prices(symbol: str, lookback_days: int = Query(60, ge=2, le=750)):
    """Close price series for the last `lookback_days` observations."""
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
    return {
        "symbol": key,
        "lookback_days": lookback_days,
        "points": points,
        "as_of": points[-1]["date"],
    }


@router.get("/vix")
async def india_vix():
    """Current India VIX level + regime band."""
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
