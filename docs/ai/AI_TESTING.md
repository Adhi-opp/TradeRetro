# AI Testing Guide

## Test Report — v1.1.0

The AI module has a dedicated automated test suite. The full backend suite stands at **279 tests**, of which **169 cover the AI module** across six files:

| File | Scope |
|---|---|
| `test_ai_router.py` | `/api/ai/*` endpoint contract: health, models, generate, validation (400 `VALIDATION_ERROR`), unknown-provider failure path |
| `test_ai_service.py` | `AIService` orchestration: success/error payload shapes, exception containment, provider selection, context propagation |
| `test_ai_context_builder.py` | 6-domain context assembly, envelope schema, metadata, user domain behaviour, legacy `build()` wrapper |
| `test_ai_prompt_builder.py` | 7-section prompt structure, ordering, determinism, reasoning registries, legacy `build()` wrapper |
| `test_ai_providers.py` | Mock, OpenAI-compatible, Ollama, and Gemini providers plus the OpenAI stub, including all error paths |
| `test_ai_provider_factory.py` | Provider resolution, registry fallback, openai-compatible wiring, legacy `LLMProviderFactory` |

This document also serves as a manual testing reference for live provider verification.

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

**Expected response (HTTP 400 with `VALIDATION_ERROR`):**

```json
{
    "error": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [
        {
            "type": "missing",
            "loc": ["body", "user_query"],
            "msg": "Field required",
            "input": {}
        }
    ]
}
```

The same `400 VALIDATION_ERROR` contract applies to malformed JSON and wrong field types (see `test_ai_router.py::TestGenerateValidation`).

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

### OpenAI Provider (Stub)

Returns:

```json
{
    "provider": "openai",
    "success": false,
    "error": "OpenAI provider is not yet implemented",
    "response": null
}
```

### Gemini Provider (Cloud)

Returns real Gemini output when `GEMINI_API_KEY` is configured and the network can reach Google's API. Uses `gemini-3.6-flash` by default (see `AIConfig.gemini_model` / `GEMINI_MODEL`).

Without an API key, returns:

```json
{
    "provider": "gemini",
    "success": false,
    "error": "No Gemini API key configured. Set GEMINI_API_KEY and restart the server.",
    "response": null
}
```

With an invalid key, returns an authentication failure error (e.g. HTTP 401). Generation typically completes in 1–5 seconds over the network.

## Automated Test Strategy

The AI suite is organized by module layer so a failure pinpoints the responsible component:

- **Router tests** boot the full FastAPI app with DB/Redis stubbed and Ollama discovery patched offline. They verify the HTTP contract, including the `400 VALIDATION_ERROR` body shape, response schema stability, and the unknown-provider `success: false` path.
- **Service tests** inject a deterministic fake factory/provider to verify orchestration: payload shapes, strict exception containment (no uncaught exceptions escape to the API), JSON parsing fallback (`{"raw_response": ...}`), and provider/query passthrough.
- **Context builder tests** verify the envelope schema stability, the user domain's non-envelope contract, metadata, and the legacy `build()` wrapper.
- **Prompt builder tests** verify the exact 7-section structure, heading order and ruling, byte-identical determinism, and that all three reasoning registries are rendered.
- **Provider tests** mock `httpx` to cover success and every documented error path (404, connect error, timeout, empty content, missing choices, auth failure) for mock, openai-compatible, Ollama, and Gemini.
- **Provider factory tests** cover resolution via registry, provider-name fallback, case-insensitivity, openai-compatible `AIConfig` wiring, and error-message content.

## Running Tests

To run the full backend suite (279 tests):

```bash
cd python-engine
pytest tests/ -v
```

To run only the AI suite (169 tests):

```bash
cd python-engine
pytest tests/test_ai_*.py -v
```

Router tests stub `services.db` and `services.redis_client` and patch Ollama discovery offline, so no infrastructure or network access is required.

## Known Expected Outputs

| Test | Input | Expected `response.response` |
|---|---|---|
| Mock generate | any prompt | `"Mock response generated successfully."` |
| OpenAI stub | any prompt | `None` (with `success: false`) |
| Gemini without API key | any prompt | `None` (with `success: false`, "No Gemini API key configured") |
