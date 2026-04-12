"""
Database Connection Pool
========================
Shared asyncpg pool managed via FastAPI lifespan.
Import `get_pool` in any router to access the pool.
"""

import asyncpg

_pool: asyncpg.Pool | None = None


async def init_pool(database_url: str, min_size: int = 2, max_size: int = 10) -> asyncpg.Pool:
    global _pool
    _pool = await asyncpg.create_pool(database_url, min_size=min_size, max_size=max_size)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_pool() first.")
    return _pool
