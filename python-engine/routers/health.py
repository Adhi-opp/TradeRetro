"""
Health Check Router — reports database, Redis, and pipeline status.
"""

from fastapi import APIRouter

from services.db import get_pool
from services.redis_client import get_redis, stream_info

router = APIRouter()


@router.get("/api/health")
async def health():
    checks = {"engine": "python", "dataSource": "timescaledb_medallion"}

    # Database check
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            version = await conn.fetchval("SELECT version();")
        checks["database"] = "connected"
        checks["pg_version"] = version
    except Exception as exc:
        checks["database"] = "disconnected"
        checks["db_error"] = str(exc)

    # Redis check
    try:
        r = get_redis()
        await r.ping()
        checks["redis"] = "connected"
        checks["stream"] = await stream_info()
    except Exception as exc:
        checks["redis"] = "disconnected"
        checks["redis_error"] = str(exc)

    # Overall status
    db_ok = checks.get("database") == "connected"
    redis_ok = checks.get("redis") == "connected"
    if db_ok and redis_ok:
        checks["status"] = "healthy"
    elif db_ok or redis_ok:
        checks["status"] = "degraded"
    else:
        checks["status"] = "unhealthy"

    return checks
