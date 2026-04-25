"""
Redis Streams interface for the tick pipeline.
Provides connection management and Stream helpers (XADD, XREADGROUP, XACK).
"""

import redis.asyncio as aioredis

from config import settings

_redis: aioredis.Redis | None = None

TICK_STREAM = "market:ticks"
CONSUMER_GROUP = "tick-consumers"
MAX_STREAM_LEN = 500_000  # Cap stream at 500k entries (~24h of data)


async def init_redis() -> aioredis.Redis:
    global _redis
    _redis = aioredis.from_url(settings.redis_url, decode_responses=False)
    await _redis.ping()
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None


def get_redis() -> aioredis.Redis:
    if _redis is None:
        raise RuntimeError("Redis not initialized — call init_redis() first")
    return _redis


# ── Stream Helpers ────────────────────────────────────────────────


async def xadd_tick(tick: dict) -> bytes:
    """Push a tick to the market:ticks stream. Returns the message ID."""
    r = get_redis()
    return await r.xadd(TICK_STREAM, tick, maxlen=MAX_STREAM_LEN, approximate=True)


async def ensure_consumer_group() -> None:
    """Create the consumer group if it doesn't already exist."""
    r = get_redis()
    try:
        await r.xgroup_create(TICK_STREAM, CONSUMER_GROUP, id="0", mkstream=True)
    except aioredis.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise


async def xreadgroup(consumer_name: str, count: int = 100, block_ms: int = 2000) -> list:
    """Read new messages from the stream as part of the consumer group."""
    r = get_redis()
    return await r.xreadgroup(
        CONSUMER_GROUP, consumer_name, {TICK_STREAM: ">"}, count=count, block=block_ms,
    )


async def xack(message_ids: list[bytes]) -> None:
    """Acknowledge processed messages."""
    r = get_redis()
    if message_ids:
        await r.xack(TICK_STREAM, CONSUMER_GROUP, *message_ids)


async def xlen() -> int:
    """Return current stream length."""
    r = get_redis()
    return await r.xlen(TICK_STREAM)


async def stream_info() -> dict:
    """Return stream metadata for health checks."""
    r = get_redis()
    try:
        info = await r.xinfo_stream(TICK_STREAM)
        return {
            "length": info.get("length", 0),
            "first_entry": info.get("first-entry"),
            "last_entry": info.get("last-entry"),
            "groups": info.get("groups", 0),
        }
    except aioredis.ResponseError:
        return {"length": 0, "status": "stream_not_created"}
