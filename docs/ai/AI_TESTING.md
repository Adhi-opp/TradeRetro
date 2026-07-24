# AI Testing Guide

## Test Report — v1.0.0

The AI module has **no dedicated automated test suite** as of v1.0.0. The existing `test_routers.py` covers health, backtest, and ingestion endpoints but does not include any `/api/ai/*` tests. All AI module testing has been performed manually against the live FastAPI server.

This document serves as both a manual testing reference and a specification for future automated tests.

## Environment

| Component | Detail |
|---|---|
| Backend | FastAPI application running on `http://localhost:8000` |
| LLM Inference Server | LM Studio (default: `http://localhost:1234`) |
| Primary Model | Qwen2.5-Coder-1.5B-Instruct (loaded in LM Studio) |
| Alternative Models | Any model registered in `REGISTERED_MODELS` or discovered via Ollama |
| Operating System | Windows 11 |
| Python | 3.12 |
| Dependencies | `fastapi`, `httpx`, `pydantic`, `pytest` (test runner) |

## Manual Testing

### Prerequisites

```bash
# Ensure python-engine dependencies are installed
pip install -r python-engine/requirements.txt

# Start the FastAPI server
cd python-engine
uvicorn main:app --reload --port 8000
```

### Test 1: Health Endpoint

```bash
curl http://localhost:8000/api/ai/health
```

**Expected response (HTTP 200):**

```json
{
    "module": "ai",
    "status": "initialized"
}
```

### Test 2: Models Endpoint

```bash
curl http://localhost:8000/api/ai/models
```

**Expected response (HTTP 200):**

An array of model objects. At minimum, `mock` will always be present. Ollama models appear if Ollama is running.

```json
[
    {"id": "mock", "display_name": "Mock Provider", "provider": "mock", "local": true},
    {"id": "qwen2.5-coder-1.5b-instruct", "display_name": "Qwen 2.5 Coder 1.5B Instruct", "provider": "openai-compatible", "local": true},
    ...
]
```

### Test 3: Generate Endpoint (Mock Provider)

```bash
curl -X POST http://localhost:8000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_query": "Explain the Sharpe ratio",
    "provider_name": "mock"
  }'
```

**Expected response (HTTP 200, deterministic):**

```json
{
    "success": true,
    "provider": "mock",
    "user_query": "Explain the Sharpe ratio",
    "prompt": "...",
    "context": {...},
    "response": {
        "provider": "mock",
        "success": true,
        "response": "Mock response generated successfully.",
        "tokens_used": 0
    },
    "error": null
}
```

The mock provider always returns the same response regardless of input. This confirms the pipeline (context → prompt → provider instantiation) works correctly.

### Test 4: Math Prompt (Mock Provider)

```bash
curl -X POST http://localhost:8000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_query": "What is 2+2?",
    "provider_name": "mock"
  }'
```

**Expected behavior:** Same deterministic mock response as Test 3. The mock provider ignores the prompt — this test validates that the full pipeline assembles context and prompt correctly (check the `prompt` field in the response to verify).

### Test 5: Identity Prompt (Mock Provider)

```bash
curl -X POST http://localhost:8000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_query": "Repeat back: Hello world",
    "provider_name": "mock"
  }'
```

**Expected behavior:** Same deterministic mock response. Again, validate by inspecting the `prompt` field — it should contain the full assembled prompt with the user query.

### Test 6: Trading Prompt with Context Data

```bash
curl -X POST http://localhost:8000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_query": "What was the Sharpe ratio?",
    "provider_name": "mock",
    "metrics_data": {
      "sharpe_ratio": 1.45,
      "max_drawdown": -0.12,
      "win_rate": 0.68
    },
    "market_data": {
      "symbol": "RELIANCE.NS",
      "close": 2850.0
    }
  }'
```

**Expected:** The `context` field in the response should show `market` and `metrics` as available, with all other domains as unavailable. The `prompt` field should contain the rendered context data under `[Market Data]` and `[Quantitative Metrics]` sections.

### Test 7: Provider Not Found

```bash
curl -X POST http://localhost:8000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_query": "test",
    "provider_name": "nonexistent-provider"
  }'
```

**Expected response (HTTP 200 with error):**

```json
{
    "success": false,
    "provider": "nonexistent-provider",
    "user_query": "test",
    "error": "Unsupported provider 'nonexistent-provider' resolved from 'nonexistent-provider'. Supported: ['mock', 'ollama', 'gemini', 'openai', 'openai-compatible']"
}
```

### Test 8: Validation Error (Missing user_query)

```bash
curl -X POST http://localhost:8000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected response (HTTP 422):**

```json
{
    "detail": [
        {
            "type": "missing",
            "loc": ["body", "user_query"],
            "msg": "Field required",
            "input": {}
        }
    ]
}
```

## LM Studio Verification

To test with a real LLM:

1. Launch LM Studio and load a model (e.g., `Qwen2.5-Coder-1.5B-Instruct`)
2. Start the local inference server (default port: 1234)
3. Run the generate endpoint with the model:

```bash
curl -X POST http://localhost:8000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_query": "What is a Sharpe ratio?",
    "provider_name": "qwen2.5-coder-1.5b-instruct"
  }'
```

**Expected:** `success: true` with a real LLM-generated response in the `response.response` field. Generation may take several seconds on consumer hardware.

## Provider Verification

### Mock Provider

Always returns success with `"Mock response generated successfully."`. Prompt is ignored. Tests: pipeline integrity.

### OpenAI-Compatible Provider (with LM Studio)

Returns real LLM output. Tests: end-to-end integration.

Without LM Studio running, returns:

```json
{
    "provider": "openai-compatible",
    "success": false,
    "error": "Cannot connect to http://localhost:1234. Is the server running?"
}
```

### Ollama Provider

Returns real LLM output when Ollama is running.

Without Ollama, returns:

```json
{
    "provider": "ollama",
    "success": false,
    "error": "Cannot connect to Ollama at http://localhost:11434. Is Ollama running?"
}
```

### OpenAI / Gemini Providers (Stubs)

Both return:

```json
{
    "provider": "openai"|"gemini",
    "success": false,
    "error": "... provider is not yet implemented",
    "response": null
}
```

## Unit Test Template

When writing automated tests, the following structure is recommended (uses `pytest` with `httpx`'s `TestClient`):

```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestAIHealth:
    def test_health_returns_module_and_status(self):
        resp = client.get("/api/ai/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["module"] == "ai"
        assert data["status"] == "initialized"


class TestAIModels:
    def test_models_returns_list(self):
        resp = client.get("/api/ai/models")
        assert resp.status_code == 200
        models = resp.json()
        assert isinstance(models, list)
        assert any(m["id"] == "mock" for m in models)


class TestAIGenerate:
    def test_generate_with_mock_provider(self):
        resp = client.post("/api/ai/generate", json={
            "user_query": "test query",
            "provider_name": "mock",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["provider"] == "mock"
        assert data["response"]["response"] == "Mock response generated successfully."

    def test_generate_missing_user_query(self):
        resp = client.post("/api/ai/generate", json={})
        assert resp.status_code == 422

    def test_generate_invalid_provider(self):
        resp = client.post("/api/ai/generate", json={
            "user_query": "test",
            "provider_name": "invalid",
        })
        assert resp.status_code == 200
        assert resp.json()["success"] is False

    def test_generate_with_context_data(self):
        resp = client.post("/api/ai/generate", json={
            "user_query": "What is the Sharpe?",
            "provider_name": "mock",
            "metrics_data": {"sharpe_ratio": 1.5},
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["context"]["metrics"]["available"] is True
        assert data["context"]["metrics"]["data"]["sharpe_ratio"] == 1.5
```

## Known Expected Outputs

| Test | Input | Expected `response.response` |
|---|---|---|
| Mock generate | any prompt | `"Mock response generated successfully."` |
| OpenAI stub | any prompt | `None` (with `success: false`) |
| Gemini stub | any prompt | `None` (with `success: false`) |

## Running Tests

Currently, no AI-specific tests exist. To run the existing test suite:

```bash
cd python-engine
pytest tests/ -v
```

The existing tests stub out `services.db` and `services.redis_client` to run without infrastructure. AI tests would not require those stubs since the AI module has no external infrastructure dependencies (other than the optional LLM backend).
