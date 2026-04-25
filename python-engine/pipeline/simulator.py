"""
Tick Simulator — generates realistic fake market ticks for pipeline testing.
Pushes to the same Redis Stream as the real Upstox producer, so the consumer
doesn't know the difference.

Usage:
    python -m pipeline.simulator            # default: 5 instruments, 10 ticks/sec
    SIMULATE_RATE=50 python -m pipeline.simulator   # 50 ticks/sec
"""

import asyncio
import json
import logging
import os
import random
import time as _time
from datetime import datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

logger = logging.getLogger("traderetro.simulator")

# Simulated NSE instruments with realistic base prices (INR)
INSTRUMENTS = {
    "NSE_EQ|INE009A01021": ("RELIANCE", 2450.0),
    "NSE_EQ|INE002A01018": ("SBIN", 780.0),
    "NSE_EQ|INE090A01021": ("ICICIBANK", 1250.0),
    "NSE_EQ|INE040A01034": ("HDFCBANK", 1620.0),
    "NSE_EQ|INE669E01016": ("TCS", 3800.0),
}


def _generate_tick(instrument_key: str, symbol: str, base_price: float) -> dict:
    """Generate a single realistic tick with random walk."""
    # Random walk: ±0.3% per tick
    pct_change = random.gauss(0, 0.003)
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

    from config import settings
    from services.redis_client import init_redis, xadd_tick

    await init_redis()
    logger.info(f"Simulator started: {len(INSTRUMENTS)} instruments, {ticks_per_second} ticks/sec")

    # Track evolving prices (random walk)
    prices = {k: base for k, (_, base) in INSTRUMENTS.items()}
    interval = 1.0 / ticks_per_second
    total_ticks = 0

    while True:
        for inst_key, (symbol, _) in INSTRUMENTS.items():
            # Evolve price with random walk
            pct = random.gauss(0, 0.0005)
            prices[inst_key] *= (1 + pct)

            tick = _generate_tick(inst_key, symbol, prices[inst_key])
            await xadd_tick({k: v.encode() if isinstance(v, str) else v for k, v in tick.items()})
            total_ticks += 1

        if total_ticks % (ticks_per_second * 10) == 0:
            logger.info(f"Simulator: {total_ticks} ticks pushed")

        await asyncio.sleep(interval)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    rate = int(os.environ.get("SIMULATE_RATE", "10"))
    asyncio.run(run_simulator(rate))
