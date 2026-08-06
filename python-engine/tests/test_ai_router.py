"""
Tests for ai/router.py — FastAPI AI endpoints.
===============================================
Verifies the /api/ai/* contract over the real FastAPI app:

  * GET  /api/ai/health  -> 200 + {module, status}
  * GET  /api/ai/models  -> 200 + model list (mock always present)
  * POST /api/ai/generate -> 200 success path (mock provider)
  * Validation failures: empty body / malformed JSON -> 400 VALIDATION_ERROR
  * Unknown provider -> 200 result with success=false + structured error
  * Response schema stability for the documented GenerateResponse shape.

DB/Redis init is stubbed (same convention as test_routers.py); registry
Ollama discovery is patched out so no network is ever attempted.
"""

from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

import pytest

import services.db
import services.redis_client


@pytest.fixture(autouse=True)
def _no_ollama_network(monkeypatch):
    """Keep model discovery offline and fast during router tests."""
    monkeypatch.setattr("ai.registry._fetch_ollama_tags", lambda: [])


@pytest.fixture
def client():
    """Boot the full FastAPI app with DB/Redis stubbed out."""
    with (
        patch.object(services.db, "init_pool", new_callable=AsyncMock),
        patch.object(services.redis_client, "init_redis", new_callable=AsyncMock),
        patch.object(services.db, "close_pool", new_callable=AsyncMock),
        patch.object(services.redis_client, "close_redis", new_callable=AsyncMock),
    ):
        from main import app
        with TestClient(app) as c:
            yield c


# ── Health ───────────────────────────────────────────────────────────────────


class TestHealth:
    def test_health_returns_200(self, client):
        resp = client.get("/api/ai/health")
        assert resp.status_code == 200

    def test_health_schema(self, client):
        data = client.get("/api/ai/health").json()
        assert data == {"module": "ai", "status": "initialized"}

    def test_health_has_no_extra_fields(self, client):
        assert set(client.get("/api/ai/health").json().keys()) == {"module", "status"}


# ── Models ──────────────────────────────────────────────────────────────────


class TestModels:
    def test_models_returns_list(self, client):
        resp = client.get("/api/ai/models")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_mock_model_always_registered(self, client):
        models = client.get("/api/ai/models").json()
        ids = [m["id"] for m in models]
        assert "mock" in ids
        assert "qwen2.5-coder-1.5b-instruct" in ids

    def test_model_entries_have_documented_keys(self, client):
        models = client.get("/api/ai/models").json()
        assert models
        for entry in models:
            assert {"id", "display_name", "provider", "local"} == set(entry.keys())

    def test_models_contains_mixed_provider_types(self, client):
        models = client.get("/api/ai/models").json()
        providers = {m["provider"] for m in models}
        assert "mock" in providers
        assert "openai-compatible" in providers
        assert "ollama" in providers


# ── Generate success ────────────────────────────────────────────────────────


class TestGenerate:
    def test_generate_mock_provider_success(self, client):
        resp = client.post("/api/ai/generate", json={
            "user_query": "Explain the Sharpe ratio",
            "provider_name": "mock",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["provider"] == "mock"

    def test_generate_response_schema(self, client):
        data = client.post("/api/ai/generate", json={
            "user_query": "q", "provider_name": "mock",
        }).json()
        assert set(data.keys()) == {
            "success", "provider", "user_query", "prompt", "context", "response", "error",
        }

    def test_generate_prompt_populated(self, client):
        data = client.post("/api/ai/generate", json={
            "user_query": "Explain drawdown", "provider_name": "mock",
        }).json()
        assert data["prompt"]
        assert "Explain drawdown" in data["prompt"]

    def test_generate_deterministic_mock_response(self, client):
        payload = client.post("/api/ai/generate", json={
            "user_query": "same", "provider_name": "mock",
        }).json()
        assert payload["response"]["response"] == "Mock response generated successfully."

    def test_generate_propagates_context(self, client):
        data = client.post("/api/ai/generate", json={
            "user_query": "what is the sharpe?",
            "provider_name": "mock",
            "metrics_data": {"sharpe_ratio": 1.45},
        }).json()
        assert data["context"]["metrics"]["available"] is True
        assert data["context"]["metrics"]["data"]["sharpe_ratio"] == 1.45
        assert data["context"]["market"]["available"] is False


# ── Generate validation ─────────────────────────────────────────────────────


class TestGenerateValidation:
    def test_empty_body_returns_400(self, client):
        resp = client.post("/api/ai/generate", json={})
        assert resp.status_code == 400

    def test_empty_body_validation_error_contract(self, client):
        resp = client.post("/api/ai/generate", json={})
        body = resp.json()
        assert body["error"] == "VALIDATION_ERROR"
        assert body["message"] == "Invalid request payload"
        assert "details" in body and isinstance(body["details"], list)

    def test_missing_user_query_returns_400(self, client):
        resp = client.post("/api/ai/generate", json={"provider_name": "mock"})
        assert resp.status_code == 400
        assert resp.json()["error"] == "VALIDATION_ERROR"

    def test_malformed_json_returns_400(self, client):
        resp = client.post(
            "/api/ai/generate",
            content=b'{invalid json',
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 400

    def test_malformed_json_error_contract(self, client):
        resp = client.post(
            "/api/ai/generate",
            content=b'{"user_query": ',
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 400
        assert resp.json()["error"] == "VALIDATION_ERROR"

    def test_wrong_field_types_return_400(self, client):
        resp = client.post("/api/ai/generate", json={
            "user_query": "q", "provider_name": 123,
        })
        assert resp.status_code == 400
        assert resp.json()["error"] == "VALIDATION_ERROR"


# ── Generate failure path ───────────────────────────────────────────────────


class TestGenerateFailure:
    def test_unknown_provider_returns_success_false(self, client):
        resp = client.post("/api/ai/generate", json={
            "user_query": "test", "provider_name": "nonexistent-provider",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "Unsupported provider" in data["error"]
        assert data["error"] is not None

    def test_unknown_provider_keeps_identity(self, client):
        data = client.post("/api/ai/generate", json={
            "user_query": "test", "provider_name": "bogus-provider",
        }).json()
        assert data["provider"] == "bogus-provider"
        assert data["user_query"] == "test"