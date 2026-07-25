# Task 5.3 — AI Provider Factory + Ollama Provider

**Branch:** `feature/ai-copilot`  
**Date:** 2026-07-24

---

## 1. Files Changed

### Created

| File | Purpose |
|---|---|
| `python-engine/ai/registry.py` | `ModelInfo` dataclass, `REGISTERED_MODELS` dict, `list_models()` and `resolve_model()` helpers |
| `python-engine/ai/ollama_provider.py` | `OllamaProvider` — calls local Ollama HTTP API with full error handling |
| `python-engine/ai/provider_factory.py` | `AIProviderFactory` — resolves model/provider names to provider instances via registry |
| `python-engine/ai/providers/gemini_provider.py` | `GeminiProvider` stub — returns "not implemented" |
| `python-engine/ai/providers/openai_provider.py` | `OpenAIProvider` stub — returns "not implemented" |

### Modified

| File | Change |
|---|---|
| `python-engine/ai/llm_provider.py` | `LLMProviderFactory` now delegates to `AIProviderFactory` |
| `python-engine/ai/providers/__init__.py` | Added `GeminiProvider` and `OpenAIProvider` to exports |
| `python-engine/ai/service.py` | Uses `AIProviderFactory` instead of `LLMProviderFactory` |

---

## 2. Architecture

```
service.py (AIService)
    │
    ▼
provider_factory.py (AIProviderFactory)
    │
    ├── registry.py ──────► ModelInfo lookup
    │
    ▼
    ├── mock ─────────────► MockLLMProvider       (working)
    ├── ollama ───────────► OllamaProvider         (working — local HTTP)
    ├── gemini ───────────► GeminiProvider         (stub — not implemented)
    └── openai ──────────► OpenAIProvider         (stub — not implemented)
```

### Resolution logic (`AIProviderFactory.get_provider`)

1. Look up input in `REGISTERED_MODELS` by model ID (e.g. `"llama3.2"`)
2. If found, read the `provider` field (e.g. `"ollama"`)
3. Map provider name to a provider class via `_provider_classes`
4. If not found in registry, treat input as a direct provider name (e.g. `"mock"`)

This means callers can use either:
- `factory.get_provider("llama3.2")` — resolves to `OllamaProvider`
- `factory.get_provider("mock")` — resolves to `MockLLMProvider`

### Registered models

| ID | Display Name | Provider | Local |
|---|---|---|---|
| `mock` | Mock Provider | mock | ✅ |
| `llama3.2` | Llama 3.2 | ollama | ✅ |
| `llama3.1` | Llama 3.1 | ollama | ✅ |
| `mistral` | Mistral | ollama | ✅ |
| `gemma2` | Gemma 2 | ollama | ✅ |
| `gemini-pro` | Gemini Pro | gemini | ❌ |
| `gpt-4o-mini` | GPT-4o Mini | openai | ❌ |

---

## 3. OllamaProvider Design

### API call
- `POST {base_url}/api/generate` with `{"model", "prompt", "stream": false}`
- Default base URL: `http://localhost:11434`
- Uses `httpx.Client` with configurable timeout (default 60s)

### Error handling

| Scenario | Response |
|---|---|
| Success | `{"success": true, "response": "...", "provider": "ollama", "model": "...", "tokens_used": null}` |
| 404 (model not found) | `{"success": false, "error": "Model '...' not found. Pull it with: ollama pull ..."}` |
| Connection refused | `{"success": false, "error": "Cannot connect to Ollama at ..."}` |
| Timeout | `{"success": false, "error": "Ollama request timed out after ..."}` |
| Generic exception | `{"success": false, "error": "..."}` |

---

## 4. Backward Compatibility

### `LLMProviderFactory` preserved
The legacy `LLMProviderFactory` class still exists in `llm_provider.py` and delegates to `AIProviderFactory`. Any code importing `LLMProviderFactory` continues to work unchanged.

### `AIService` updated
The `AIService.__init__` now defaults to `AIProviderFactory()` instead of `LLMProviderFactory()`. Since `router.py` instantiates `AIService()` with no arguments, this is a seamless swap.

### Stub providers
`GeminiProvider` and `OpenAIProvider` return "not implemented" JSON — they register correctly in the factory without breaking resolution for other providers.

---

## 5. Tests Performed

| # | Test | Result |
|---|---|---|
| 1 | Registry contains all 7 models | Pass |
| 2 | `resolve_model` returns correct provider for each model | Pass |
| 3 | `AIProviderFactory.get_provider("mock")` → `MockLLMProvider` | Pass |
| 4 | `AIProviderFactory.get_provider("llama3.2")` → `OllamaProvider` | Pass |
| 5 | `AIProviderFactory.get_provider("gemini-pro")` → `GeminiProvider` | Pass |
| 6 | Legacy `LLMProviderFactory.get_provider("mock")` still works | Pass |
| 7 | `MockLLMProvider` returns valid JSON response | Pass |
| 8 | `OllamaProvider` returns graceful connection error (no server) | Pass |
| 9 | `GeminiProvider` returns "not implemented" stub | Pass |
| 10 | Full `AIService.generate_response()` pipeline still works | Pass |

---

## 6. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Ollama not installed `httpx` network call blocks synchronous | Low | Error caught and returned as structured JSON failure; `AIService` handles it gracefully |
| `OllamaProvider` is synchronous (blocks event loop) | Low | Acceptable for now; can be made async when streaming is required |
| `AIProviderFactory` import chain adds more module dependencies | Low | All imports are local to the `ai` package; no circular dependencies |

---

## 7. Suggested Git Commit Message

```
feat(ai): add provider factory, model registry, and Ollama provider

- Create registry.py with ModelInfo dataclass and REGISTERED_MODELS
- Create provider_factory.py with AIProviderFactory (registry-backed)
- Create ollama_provider.py with OllamaProvider (local HTTP API)
- Add GeminiProvider and OpenAIProvider stubs for future use
- Update LLMProviderFactory to delegate to AIProviderFactory
- Update AIService to use AIProviderFactory by default
- All error cases handled: connection, timeout, model not found, empty
```
