"""
Redis Streams → TimescaleDB Consumer
=====================================
Reads tick messages from the `market:ticks` Redis Stream using a consumer
group, batch-inserts them into `bronze.market_ticks`, and acknowledges.

Design choices:
    - Batch insert (executemany) for throughput — not row-at-a-time
    - Consumer group ensures at-least-once delivery
    - ON CONFLICT DO NOTHING for idempotency on reprocessing
"""

import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from services.db import get_pool
from services.redis_client import ensure_consumer_group, xreadgroup, xack, xlen

logger = logging.getLogger("traderetro.consumer")

IST = ZoneInfo("Asia/Kolkata")
CONSUMER_NAME = "consumer-1"
BATCH_SIZE = 200
IDLE_LOG_INTERVAL = 60  # Log every 60s when idle

INSERT_SQL = """
INSERT INTO bronze.market_ticks
    (instrument_key, timestamp, ltp, volume, oi, bid_price, ask_price, bid_qty, ask_qty)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT DO NOTHING;
"""


def _decode_field(fields: dict, key: str, default: str = "0") -> str:
    """Decode a Redis field from bytes to string."""
    val = fields.get(key.encode()), fields.get(key)
    for v in val:
        if v is not None:
            return v.decode() if isinstance(v, bytes) else str(v)
    return default


def _parse_tick(fields: dict) -> tuple:
    """Convert Redis hash fields to a DB insert tuple."""
    instrument_key = _decode_field(fields, "instrument_key", "UNKNOWN")
    timestamp_str = _decode_field(fields, "timestamp", "")
    ltp = float(_decode_field(fields, "ltp", "0"))
    volume = int(_decode_field(fields, "volume", "0"))
    oi = float(_decode_field(fields, "oi", "0"))
    bid_price = float(_decode_field(fields, "bid_price", "0"))
    ask_price = float(_decode_field(fields, "ask_price", "0"))
    bid_qty = int(_decode_field(fields, "bid_qty", "0"))
    ask_qty = int(_decode_field(fields, "ask_qty", "0"))

    # Parse timestamp — accept ISO format or fall back to now()
    try:
        ts = datetime.fromisoformat(timestamp_str)
    except (ValueError, TypeError):
        ts = datetime.now(IST)

    return (instrument_key, ts, ltp, volume, oi, bid_price, ask_price, bid_qty, ask_qty)


async def consume_loop() -> None:
    """
    Main consumer loop — runs forever.
    Reads batches from Redis, inserts into TimescaleDB, acknowledges.
    """
    await ensure_consumer_group()
    pool = get_pool()

    total_inserted = 0
    last_log = asyncio.get_event_loop().time()
    logger.info(f"Consumer '{CONSUMER_NAME}' started — reading from Redis Stream")

    while True:
        results = await xreadgroup(CONSUMER_NAME, count=BATCH_SIZE, block_ms=2000)

        if not results:
            # No new messages — log periodically so we know the consumer is alive
            now = asyncio.get_event_loop().time()
            if now - last_log > IDLE_LOG_INTERVAL:
                stream_len = await xlen()
                logger.info(f"Consumer idle — stream length: {stream_len}, total inserted: {total_inserted}")
                last_log = now
            continue

        rows = []
        msg_ids = []

        for _stream, messages in results:
            for msg_id, fields in messages:
                msg_ids.append(msg_id)
                try:
                    rows.append(_parse_tick(fields))
                except Exception as exc:
                    logger.warning(f"Skipping malformed tick {msg_id}: {exc}")

        if rows:
            try:
                async with pool.acquire() as conn:
                    await conn.executemany(INSERT_SQL, rows)
                total_inserted += len(rows)
            except Exception as exc:
                logger.error(f"DB insert failed for {len(rows)} rows: {exc}")
                # Don't ack — messages will be redelivered
                continue

        # Acknowledge only after successful insert
        await xack(msg_ids)

        if total_inserted % 1000 < len(rows):
            logger.info(f"Consumer: {total_inserted} ticks inserted into bronze.market_ticks")
