import uvicorn
import redis.asyncio as aioredis

import services.redis_client as redis_client


class DummyRedis:
    async def ping(self):
        return True

    async def aclose(self):
        return None

    async def xinfo_stream(self, *args, **kwargs):
        raise aioredis.ResponseError("stream not created")

    async def xlen(self, *args, **kwargs):
        return 0

    async def xadd(self, *args, **kwargs):
        return b"0-0"

    async def xgroup_create(self, *args, **kwargs):
        return True

    async def xreadgroup(self, *args, **kwargs):
        return []

    async def xack(self, *args, **kwargs):
        return 0


_dummy = DummyRedis()
redis_client._redis = _dummy


async def init_redis():
    redis_client._redis = _dummy
    return _dummy


async def close_redis():
    return None


def get_redis():
    return _dummy


redis_client.init_redis = init_redis
redis_client.close_redis = close_redis
redis_client.get_redis = get_redis

from main import app  # noqa: E402


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
