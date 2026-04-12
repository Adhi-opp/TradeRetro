"""
Health Check Router
"""

from fastapi import APIRouter

from services.db import get_pool

router = APIRouter()


@router.get("/api/health")
async def health():
    checks = {"engine": "python", "dataSource": "timescaledb_medallion"}

    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            version = await conn.fetchval("SELECT version();")
        checks["database"] = "connected"
        checks["pg_version"] = version
        checks["status"] = "healthy"
    except Exception as exc:
        checks["database"] = "disconnected"
        checks["error"] = str(exc)
        checks["status"] = "degraded"

    return checks
