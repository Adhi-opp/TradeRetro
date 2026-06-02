"""
Upstox V3 historical/intraday candle REST client.

Used by the self-healing reconciliation flow to recover 1-minute OHLCV bars
that the live WebSocket missed (e.g. a mid-session disconnect). This is the
"patch from an authoritative source" side of the dropped-tick problem.

Endpoint (V3):
    GET /v3/historical-candle/intraday/{instrument_key}/{unit}/{interval}
        → today's candles
    GET /v3/historical-candle/{instrument_key}/{unit}/{interval}/{to}/{from}
        → past days' candles

Response shape:
    {"status": "success",
     "data": {"candles": [[ts, open, high, low, close, volume, oi], ...]}}
"""

import logging
from datetime import datetime
from urllib.parse import quote

import httpx

from services.upstox_client import upstox_auth

logger = logging.getLogger("traderetro.upstox_history")

_BASE = "https://api.upstox.com/v3/historical-candle"


def _parse_candles(payload: dict) -> list[dict]:
    """Parse Upstox candle arrays into ascending OHLCV dicts."""
    candles = ((payload or {}).get("data") or {}).get("candles") or []
    out = []
    for c in candles:
        # [timestamp, open, high, low, close, volume, open_interest]
        if not c or len(c) < 6:
            continue
        try:
            out.append({
                "bucket": datetime.fromisoformat(c[0]),
                "open": float(c[1]),
                "high": float(c[2]),
                "low": float(c[3]),
                "close": float(c[4]),
                "volume": int(c[5]),
            })
        except (ValueError, TypeError):
            continue
    out.sort(key=lambda r: r["bucket"])
    return out


async def fetch_intraday_1min(instrument_key: str) -> list[dict]:
    """
    Fetch today's 1-minute candles for an instrument from Upstox.

    Returns a list of {bucket(tz-aware), open, high, low, close, volume},
    ascending by time. Raises RuntimeError if not authenticated.
    """
    token = await upstox_auth.get_access_token()
    if not token:
        raise RuntimeError("Not authenticated — reconciliation needs an Upstox token")

    key_enc = quote(instrument_key, safe="")
    url = f"{_BASE}/intraday/{key_enc}/minutes/1"

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            url,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        )
        resp.raise_for_status()
        payload = resp.json()

    bars = _parse_candles(payload)
    logger.info("Upstox intraday fetch %s → %d candles", instrument_key, len(bars))
    return bars


async def fetch_historical_1min(instrument_key: str, from_date: str, to_date: str) -> list[dict]:
    """
    Fetch 1-minute candles for a past date range (YYYY-MM-DD). Used to patch
    gaps from earlier sessions (the intraday endpoint only covers today).
    """
    token = await upstox_auth.get_access_token()
    if not token:
        raise RuntimeError("Not authenticated — reconciliation needs an Upstox token")

    key_enc = quote(instrument_key, safe="")
    url = f"{_BASE}/{key_enc}/minutes/1/{to_date}/{from_date}"

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            url,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        )
        resp.raise_for_status()
        payload = resp.json()

    return _parse_candles(payload)
