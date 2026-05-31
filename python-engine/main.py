"""
TradeRetro - Unified Python Backend
====================================
Single FastAPI app consolidating backtest engine, live market data,
cross-asset correlation, and signal serving. All services use a
shared asyncpg pool.
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

# Surface app-level logger output through uvicorn's stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from services.db import init_pool, close_pool
from services.redis_client import init_redis, close_redis
from services.scheduler import run_eod_scheduler
from routers import backtest, signals, health, auth, ingestion, correlation, universe, live, quality


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize connection pool and Redis
    await init_pool(settings.database_url)
    await init_redis()

    # Background scheduler: run EOD pipeline daily at 16:00 IST on weekdays.
    # Disable via DISABLE_EOD_SCHEDULER=1 (e.g. for tests or when running
    # multiple API replicas to avoid double-triggering).
    scheduler_task = None
    if not os.environ.get("DISABLE_EOD_SCHEDULER"):
        scheduler_task = asyncio.create_task(run_eod_scheduler(), name="eod_scheduler")

    yield

    # Shutdown: stop scheduler, close connections
    if scheduler_task:
        scheduler_task.cancel()
    await close_redis()
    await close_pool()


app = FastAPI(
    title="TradeRetro Engine",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount Routers ─────────────────────────────────────────────
app.include_router(health.router)
app.include_router(backtest.router)
app.include_router(signals.router)
app.include_router(auth.router)
app.include_router(ingestion.router)
app.include_router(correlation.router)
app.include_router(universe.router)
app.include_router(live.router)
app.include_router(quality.router)


# ── Exception Handlers ────────────────────────────────────────

def _error_body(error: str, message: str, details=None) -> dict:
    body = {"error": error, "message": message}
    if details is not None:
        body["details"] = details
    return body


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict):
        body = detail
    elif isinstance(detail, list):
        body = _error_body("VALIDATION_ERROR", "Invalid request payload", detail)
    else:
        body = _error_body("HTTP_ERROR", str(detail))
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request, exc: RequestValidationError):
    # jsonable_encoder is required: a ValueError raised inside a Pydantic v2
    # model_validator lands in the error's `ctx` as a raw exception object,
    # which json.dumps cannot serialize (would 500 the validation response).
    return JSONResponse(
        status_code=400,
        content=_error_body("VALIDATION_ERROR", "Invalid request payload", jsonable_encoder(exc.errors())),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content=_error_body("INTERNAL_ERROR", f"Unexpected server error: {exc}"),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.host, port=settings.port)
