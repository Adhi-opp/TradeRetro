"""
Tick Simulator — generates realistic fake market ticks for pipeline testing.
Pushes to the same Redis Stream as the real Upstox producer, so the consumer
doesn't know the difference.

Usage:
    python -m pipeline.simulator            # default: 5 instruments, 10 ticks/sec
    SIMULATE_RATE=50 python -m pipeline.simulator   # 50 ticks/sec
"""

import asyncio
import logging
import os
import random
from datetime import datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

logger = logging.getLogger("traderetro.simulator")

# Simulated NSE instruments. Base prices are a fallback only — on startup
# the simulator queries the EOD warehouse for the most recent close per
# symbol so that "live" ticks plausibly continue from the latest known
# real price. Live mode (PIPELINE_MODE=live) pulls real prices from the
# Upstox WebSocket V3 feed and ignores these.
INSTRUMENTS = {
    "NSE_EQ|INE009A01021":   ("RELIANCE",   "RELIANCE.NS",   2950.0),
    "NSE_EQ|INE002A01018":   ("SBIN",       "SBIN.NS",        820.0),
    "NSE_EQ|INE090A01021":   ("ICICIBANK",  "ICICIBANK.NS",  1290.0),
    "NSE_EQ|INE040A01034":   ("HDFCBANK",   "HDFCBANK.NS",   1750.0),
    "NSE_EQ|INE669E01016":   ("TCS",        "TCS.NS",        3700.0),
    "NSE_EQ|INE154A01025":   ("ITC",        "ITC.NS",         475.0),
    "NSE_EQ|INE118H01025":   ("BHARTIARTL", "BHARTIARTL.NS", 1620.0),
    "NSE_EQ|INE028A01039":   ("BAJFINANCE", "BAJFINANCE.NS", 7100.0),
    "NSE_EQ|INE860A01027":   ("HCLTECH",    "HCLTECH.NS",    1810.0),
    "NSE_EQ|INE467B01029":   ("INFY",       "INFY.NS",       1880.0),
    "NSE_EQ|INE238A01034":   ("AXISBANK",   "AXISBANK.NS",   1240.0),
    "NSE_INDEX|Nifty 50":    ("NIFTY50",    "NIFTY50.NS",   25050.0),
    "NSE_INDEX|Nifty Bank":  ("BANKNIFTY",  "BANKNIFTY.NS", 52400.0),
    "NSE_INDEX|India VIX":   ("INDIAVIX",   "INDIAVIX",        13.8),
}


async def _bootstrap_prices_from_warehouse() -> dict[str, float]:
    """
    Query latest EOD close per instrument from raw.historical_prices so
    simulated ticks plausibly continue from the last known real price.
    Falls back to the hardcoded base price for any symbol not in the warehouse.
    """
    try:
        from config import settings
        from services.db import init_pool, get_pool

        try:
            pool = get_pool()
        except RuntimeError:
            await init_pool(settings.database_url)
            pool = get_pool()

        warehouse_tickers = [v[1] for v in INSTRUMENTS.values()]
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT DISTINCT ON (ticker) ticker, close_price
                FROM raw.historical_prices
                WHERE ticker = ANY($1::text[])
                ORDER BY ticker, trade_date DESC
                """,
                warehouse_tickers,
            )
        latest = {r["ticker"]: float(r["close_price"]) for r in rows}
    except Exception as exc:
        logger.warning("Could not bootstrap simulator from warehouse: %s", exc)
        latest = {}

    prices: dict[str, float] = {}
    for inst_key, (_sym, warehouse_key, fallback) in INSTRUMENTS.items():
        prices[inst_key] = latest.get(warehouse_key, fallback)
    return prices


def _generate_tick(instrument_key: str, symbol: str, base_price: float) -> dict:
    """Generate a single realistic tick — small bounded oscillation around base."""
    # Bounded oscillation: stdev ~0.05% per tick, no compounding (each tick
    # is independent from the anchor). Keeps the displayed price within
    # ~0.15% of the EOD anchor 99% of the time.
    pct_change = random.gauss(0, 0.0005)
    price = base_price * (1 + pct_change)
    spread = price * 0.001  # 0.1% spread

    return {
        "instrument_key": instrument_key,
        "symbol": symbol,
        "ltp": f"{price:.2f}",
        "volume": str(random.randint(100, 50000)),
        "oi": "0",
        "bid_price": f"{price - spread:.2f}",
        "ask_price": f"{price + spread:.2f}",
        "bid_qty": str(random.randint(10, 5000)),
        "ask_qty": str(random.randint(10, 5000)),
        "timestamp": datetime.now(IST).isoformat(),
        "source": "simulator",
    }


async def run_simulator(ticks_per_second: int = 10) -> None:
    """Main simulator loop — pushes fake ticks to Redis Stream."""
    # Late import to avoid circular dependency when used as standalone
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    from services.redis_client import init_redis, xadd_tick

    await init_redis()

    # Bootstrap anchor prices from the warehouse so simulated ticks plausibly
    # continue from the last known real close. Anchors are fixed for the run;
    # _generate_tick oscillates around them with bounded noise so prices don't
    # drift unboundedly between dashboard refreshes.
    anchors = await _bootstrap_prices_from_warehouse()
    sample = {INSTRUMENTS[k][0]: round(v, 2) for k, v in list(anchors.items())[:5]}
    logger.info(
        "Simulator started: %d instruments, %d ticks/sec, anchor sample=%s",
        len(INSTRUMENTS), ticks_per_second, sample,
    )

    interval = 1.0 / ticks_per_second
    total_ticks = 0

    while True:
        for inst_key, (symbol, _warehouse_key, _fallback) in INSTRUMENTS.items():
            tick = _generate_tick(inst_key, symbol, anchors[inst_key])
            await xadd_tick({k: v.encode() if isinstance(v, str) else v for k, v in tick.items()})
            total_ticks += 1

        if total_ticks % (ticks_per_second * 10) == 0:
            logger.info(f"Simulator: {total_ticks} ticks pushed")

        await asyncio.sleep(interval)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    rate = int(os.environ.get("SIMULATE_RATE", "10"))
    asyncio.run(run_simulator(rate))
