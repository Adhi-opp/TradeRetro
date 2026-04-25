"""
Ticker Resolver
===============
Normalizes user-supplied ticker strings to the warehouse storage key
and resolves display metadata via yfinance.

Rules:
- Indices (NIFTY 50, BANKNIFTY) -> NIFTY50.NS / BANKNIFTY.NS
- Macro cross-assets (USDINR, CRUDE, INDIAVIX) -> stored bare
- Everything else with no suffix -> appended with .NS (NSE equities)
- Already-suffixed tickers (.NS, .BO) -> passed through

yfinance is used only to fetch a human-readable display name; we do
NOT block ticker addition on yfinance availability (keeps the flow
resilient to rate limits).
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

logger = logging.getLogger("traderetro.ticker_resolver")


_DISPLAY_TO_KEY = {
    "NIFTY 50": "NIFTY50.NS",
    "NIFTY50": "NIFTY50.NS",
    "NIFTY": "NIFTY50.NS",
    "BANK NIFTY": "BANKNIFTY.NS",
    "BANKNIFTY": "BANKNIFTY.NS",
    "USDINR": "USDINR",
    "USD/INR": "USDINR",
    "USD INR": "USDINR",
    "CRUDE": "CRUDE",
    "CRUDE OIL": "CRUDE",
    "INDIA VIX": "INDIAVIX",
    "INDIAVIX": "INDIAVIX",
    "VIX": "INDIAVIX",
}

_MACRO_KEYS = {"USDINR", "CRUDE", "INDIAVIX"}

_INDEX_KEYS = {"NIFTY50.NS", "BANKNIFTY.NS"}

# yfinance lookup map (stored_key -> yahoo symbol)
YAHOO_SYMBOL_MAP = {
    "NIFTY50.NS": "^NSEI",
    "BANKNIFTY.NS": "^NSEBANK",
    "USDINR": "INR=X",
    "CRUDE": "BZ=F",
    "INDIAVIX": "^INDIAVIX",
}


@dataclass(frozen=True)
class ResolvedTicker:
    symbol: str           # warehouse storage key (e.g., RELIANCE.NS)
    yahoo_symbol: str     # yfinance download symbol (e.g., RELIANCE.NS or ^NSEI)
    display_name: str     # human-readable (e.g., "Reliance Industries")
    asset_class: str      # equity | index | forex | commodity | vol


def normalize(raw: str) -> str:
    """Coerce a user-supplied ticker to the DB storage key."""
    t = (raw or "").strip()
    if not t:
        raise ValueError("ticker is empty")
    up = t.upper()
    if up in _DISPLAY_TO_KEY:
        return _DISPLAY_TO_KEY[up]
    if up in _MACRO_KEYS:
        return up
    if up.endswith(".NS") or up.endswith(".BO"):
        return up
    return f"{up}.NS"


def yahoo_symbol_for(key: str) -> str:
    return YAHOO_SYMBOL_MAP.get(key, key)


def asset_class_for(key: str) -> str:
    if key in {"USDINR"}:
        return "forex"
    if key == "CRUDE":
        return "commodity"
    if key == "INDIAVIX":
        return "vol"
    if key in _INDEX_KEYS:
        return "index"
    return "equity"


def _probe_yfinance(key: str) -> tuple[bool, str]:
    """Synchronous yfinance probe. Returns (exists, display_name)."""
    try:
        import yfinance as yf
    except ImportError:
        return True, key  # skip probe if yfinance unavailable

    yf_symbol = yahoo_symbol_for(key)
    try:
        t = yf.Ticker(yf_symbol)
        info = t.fast_info
        # fast_info raises if symbol is bogus
        if getattr(info, "last_price", None) is None:
            # Fall back to full info for edge cases
            full = t.info
            name = full.get("shortName") or full.get("longName") or key
            return bool(full), name
        # Try to grab a nicer name
        try:
            full = t.info
            name = full.get("shortName") or full.get("longName") or key
        except Exception:
            name = key
        return True, name
    except Exception as exc:
        logger.warning("yfinance probe failed for %s: %s", yf_symbol, exc)
        return False, key


async def resolve(raw: str, probe_metadata: bool = True) -> ResolvedTicker:
    """
    Resolve a raw ticker string into a ResolvedTicker.

    If probe_metadata is False we skip the yfinance probe (faster but
    display_name defaults to the symbol itself).
    """
    key = normalize(raw)
    ac = asset_class_for(key)
    yf_symbol = yahoo_symbol_for(key)

    if not probe_metadata:
        return ResolvedTicker(symbol=key, yahoo_symbol=yf_symbol, display_name=key, asset_class=ac)

    loop = asyncio.get_running_loop()
    exists, name = await loop.run_in_executor(None, _probe_yfinance, key)
    if not exists:
        raise ValueError(f"ticker '{raw}' could not be verified via yfinance")
    return ResolvedTicker(symbol=key, yahoo_symbol=yf_symbol, display_name=name, asset_class=ac)
