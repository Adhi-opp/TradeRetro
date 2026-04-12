"""
Pipeline Worker — entry point for the pipeline-worker Docker container.

Runs the consumer (Redis → TimescaleDB) and optionally the simulator
or the real Upstox WebSocket producer, depending on configuration.

Environment variables:
    PIPELINE_MODE = "simulate" | "live" | "consumer_only"
        - simulate:      run simulator + consumer (default, for dev/demo)
        - live:          run Upstox WebSocket producer + consumer
        - consumer_only: run only the consumer (producer runs separately)
    SIMULATE_RATE = 10   ticks/second for simulator mode
"""

import asyncio
import logging
import os
import sys

# Ensure the project root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import settings
from services.db import init_pool, close_pool
from services.redis_client import init_redis, close_redis
from pipeline.consumer import consume_loop

logger = logging.getLogger("traderetro.worker")


async def main() -> None:
    mode = os.environ.get("PIPELINE_MODE", "simulate").lower()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )

    logger.info(f"Pipeline worker starting — mode={mode}")

    # Initialize shared connections
    await init_pool(settings.database_url)
    await init_redis()
    logger.info("Database pool and Redis connected")

    tasks: list[asyncio.Task] = []

    try:
        # Always run the consumer
        tasks.append(asyncio.create_task(consume_loop(), name="consumer"))

        if mode == "simulate":
            from pipeline.simulator import run_simulator
            rate = int(os.environ.get("SIMULATE_RATE", "10"))
            tasks.append(asyncio.create_task(run_simulator(rate), name="simulator"))
            logger.info(f"Simulator started at {rate} ticks/sec")

        elif mode == "live":
            from pipeline.upstox_ws import produce
            tasks.append(asyncio.create_task(produce(), name="ws_producer"))
            logger.info("Upstox WebSocket producer started")

        elif mode == "consumer_only":
            logger.info("Consumer-only mode — no producer")

        else:
            logger.warning(f"Unknown PIPELINE_MODE '{mode}', defaulting to consumer_only")

        # Run until cancelled
        await asyncio.gather(*tasks)

    except asyncio.CancelledError:
        logger.info("Worker shutting down...")
    finally:
        for t in tasks:
            t.cancel()
        await close_redis()
        await close_pool()
        logger.info("Worker stopped")


if __name__ == "__main__":
    asyncio.run(main())
