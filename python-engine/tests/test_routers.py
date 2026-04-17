"""
Tests for FastAPI routers — endpoint structure, request validation, error handling.
Uses FastAPI TestClient with mocked DB/Redis to avoid needing live infrastructure.

Requires: fastapi, httpx, redis, asyncpg (the full python-engine dependency set).
Skip gracefully if dependencies are missing (local dev without full venv).
"""

import sys
import types
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

# Stub out heavy deps if not installed so we can at least import main.py
_STUBS_NEEDED = []
for mod_name in ("redis", "redis.asyncio", "asyncpg", "prefect",
                 "prefect.deployments", "prefect.runtime"):
    if mod_name not in sys.modules:
        try:
            __import__(mod_name)
        except ImportError:
            stub = types.ModuleType(mod_name)
            # redis.asyncio needs Redis class, asyncpg needs Pool, etc.
            stub.Redis = MagicMock
            stub.Pool = MagicMock
            stub.flow = lambda *a, **kw: (lambda f: f)
            stub.task = lambda *a, **kw: (lambda f: f)
            stub.get_run_logger = MagicMock
            sys.modules[mod_name] = stub
            _STUBS_NEEDED.append(mod_name)

from fastapi.testclient import TestClient

import services.db
import services.redis_client


# ── Fixtures ──────────────────────────────────────────────────


@pytest.fixture
def client():
    """Create a TestClient with mocked DB and Redis so app boots without infra."""
    with (
        patch.object(services.db, "init_pool", new_callable=AsyncMock),
        patch.object(services.redis_client, "init_redis", new_callable=AsyncMock),
        patch.object(services.db, "close_pool", new_callable=AsyncMock),
        patch.object(services.redis_client, "close_redis", new_callable=AsyncMock),
    ):
        from main import app
        with TestClient(app) as c:
            yield c


# ── Health endpoint ───────────────────────────────────────────


def test_health_endpoint_structure(client):
    """Health endpoint should return JSON with expected keys even if services are down."""
    with (
        patch("routers.health.get_pool", side_effect=RuntimeError("no pool")),
        patch("routers.health.get_redis", side_effect=RuntimeError("no redis")),
    ):
        resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "engine" in data
    assert data["engine"] == "python"
    assert "status" in data


# ── Backtest endpoint ─────────────────────────────────────────


def test_backtest_rejects_missing_fields(client):
    """POST /api/backtest with empty body should return 400."""
    resp = client.post("/api/backtest", json={})
    assert resp.status_code == 400


def test_backtest_rejects_invalid_strategy(client):
    """POST /api/backtest with unknown strategy should return 400."""
    resp = client.post("/api/backtest", json={
        "symbol": "RELIANCE.NS",
        "strategyType": "DOES_NOT_EXIST",
        "params": {"initialCapital": 100000},
        "startDate": "2023-01-01",
        "endDate": "2024-01-01",
    })
    assert resp.status_code == 400


# ── BS Detector endpoint ─────────────────────────────────────


def test_verify_strategy_rejects_empty(client):
    """POST /api/verify-strategy with empty body should return 400."""
    resp = client.post("/api/verify-strategy", json={})
    assert resp.status_code == 400


# ── Ingestion endpoints ──────────────────────────────────────


def test_ingest_flows_returns_list(client):
    """GET /api/ingest/flows should return an empty list initially."""
    resp = client.get("/api/ingest/flows")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_ingest_status_not_found(client):
    """GET /api/ingest/status/<bogus> should return 404."""
    resp = client.get("/api/ingest/status/nonexistent-flow-id")
    assert resp.status_code == 404


def test_ingest_eod_trigger_accepted(client):
    """POST /api/ingest/eod should accept and return flow_id, even without DB."""
    with patch("routers.ingestion.asyncio.create_task"):
        resp = client.post("/api/ingest/eod", json={"tickers": ["RELIANCE.NS"]})
    assert resp.status_code == 200
    data = resp.json()
    assert "flow_id" in data
    assert data["status"] == "triggered"


def test_ingest_backfill_trigger_accepted(client):
    """POST /api/ingest/backfill should accept with custom period."""
    with patch("routers.ingestion.asyncio.create_task"):
        resp = client.post("/api/ingest/backfill", json={
            "tickers": ["SBIN.NS"],
            "period": "5y",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["period"] == "5y"


def test_ingest_quality_trigger_accepted(client):
    """POST /api/ingest/quality-audit should accept."""
    with patch("routers.ingestion.asyncio.create_task"):
        resp = client.post("/api/ingest/quality-audit", json={})
    assert resp.status_code == 200
    data = resp.json()
    assert "flow_id" in data


def test_ingest_history_requires_db():
    """GET /api/ingest/history should fail when DB pool is not available."""
    with (
        patch.object(services.db, "init_pool", new_callable=AsyncMock),
        patch.object(services.redis_client, "init_redis", new_callable=AsyncMock),
        patch.object(services.db, "close_pool", new_callable=AsyncMock),
        patch.object(services.redis_client, "close_redis", new_callable=AsyncMock),
    ):
        from main import app
        with TestClient(app, raise_server_exceptions=False) as c:
            with patch("routers.ingestion.get_pool", side_effect=RuntimeError("no pool")):
                resp = c.get("/api/ingest/history")
            assert resp.status_code == 500
