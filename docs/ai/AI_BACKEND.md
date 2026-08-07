# AI Backend — File Reference

Every source file in the `python-engine/ai/` module, its purpose, dependencies, and interactions.

## File Map

| File | Type | Role |
|---|---|---|
| `__init__.py` | Package | Module docstring placeholder |
| `config.py` | Configuration | `AIConfig` dataclass + `AIConfigurationManager` |
| `service.py` | Orchestration | `AIService` — coordinates the full pipeline |
| `router.py` | API | FastAPI router — HTTP endpoints |
| `context_builder.py` | Data | `ContextBuilder` — domain context assembly |
| `prompt_builder.py` | Data | `PromptBuilder` — prompt string construction |
| `provider_factory.py` | Factory | `AIProviderFactory` — provider resolution |
| `registry.py` | Registry | `ModelInfo` + static/dynamic model catalog |
| `ollama_provider.py` | Provider | `OllamaProvider` — Ollama HTTP API |
| `llm_provider.py` | Legacy | Deprecated re-exports |
| `models/__init__.py` | Package | Package marker |
| `models/chat.py` | Models | Pydantic request/response schemas |
| `providers/__init__.py` | Package | Provider class exports |
| `providers/base_provider.py` | Interface | `BaseLLMProvider` abstract base class |
| `providers/mock_provider.py` | Provider | `MockLLMProvider` — deterministic testing |
| `providers/openai_provider.py` | Provider | `OpenAIProvider` — stub (not implemented) |
| `providers/openai_compatible_provider.py` | Provider | `OpenAICompatibleProvider` — primary working provider |
| `providers/gemini_provider.py` | Provider | `GeminiProvider` — Google Gemini generateContent API |
| `prompts/risk.md` | Template | Placeholder — risk assessment prompt |
| `prompts/metrics.md` | Template | Placeholder — metrics explanation prompt |
| `prompts/strategy.md` | Template | Placeholder — strategy analysis prompt |

---

## `__init__.py`

Package initializer carrying only a module-level docstring. No imports, no logic.

---

## `config.py`

Houses `AIConfig` (a plain `@dataclass`) and `AIConfigurationManager` for validated runtime updates. Every tunable lives here:

| Field | Default | Note |
|---|---|---|
| `enabled` | `True` | Master toggle |
| `provider` | `"openai-compatible"` | Default backend |
| `model` | `"qwen2.5-coder-1.5b-instruct"` | Default model ID |
| `temperature` | `0.2` | Sampler temperature (configured default; not currently passed to providers) |
| `max_tokens` | `1024` | Max response tokens (configured default; not currently passed to providers) |
| `timeout_seconds` | `30` | Reserved; providers use their own internal timeouts (`OpenAICompatibleProvider` 120s, `OllamaProvider` 60s, `GeminiProvider` 60s) |
| `debug` | `False` | Debug logging |
| `openai_compatible_base_url` | `"http://localhost:1234"` | LM Studio default |
| `openai_compatible_api_key` | `"not-needed"` | Local servers rarely need auth |
| `gemini_api_key` | `""` | Gemini API key; defaults to `GEMINI_API_KEY` env var |
| `gemini_model` | `"gemini-3.6-flash"` | Gemini model ID; defaults to `GEMINI_MODEL` env var |
| `gemini_base_url` | `"https://generativelanguage.googleapis.com"` | Gemini API base URL; defaults to `GEMINI_BASE_URL` env var |

`AIConfigurationManager` wraps the dataclass with validation: temperature is clamped to `[0.0, 2.0]`, `max_tokens` must be positive. `reset_defaults()` restores factory state.

AI configuration is intentionally self-contained. The Gemini fields also support environment variable overrides (`GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_BASE_URL`); other fields require code changes for different environments.

**Imported by:** `service.py`, `provider_factory.py`, `llm_provider.py`.

---

## `service.py`

The central coordinator. `AIService.generate_response()` runs the full pipeline:

1. `ContextBuilder.build()` assembles domain data into a unified context dict
2. `PromptBuilder.build()` turns the context plus user query into a prompt string
3. `AIProviderFactory.get_provider()` resolves the provider name (falls back to `config.model`)
4. The provider's `generate_response(prompt)` returns a JSON string
5. `json.loads()` parses the result; if parsing fails, wraps it as `{"raw_response": ...}`
6. Returns a dict with `success`, `provider`, `user_query`, `prompt`, `context`, `response`, `error`

The entire pipeline is wrapped in a single `try/except`. On any failure it returns `{"success": false, "error": str(exc)}` and logs the traceback.

All dependencies (`ContextBuilder`, `PromptBuilder`, `AIProviderFactory`, `AIConfig`) are injected via the constructor and default to fresh instances if omitted. The only consumer is `router.py`.

---

## `router.py`

Exposes three endpoints under `/api/ai` via a module-level `ai_service = AIService()` singleton:

| Method | Path | Handler | Response Model |
|---|---|---|---|
| GET | `/api/ai/health` | `health()` | `AIHealthResponse` |
| GET | `/api/ai/models` | `list_available_models()` | `list` |
| POST | `/api/ai/generate` | `generate(body)` | `GenerateResponse` |

Mounted in `main.py` as `from ai.router import router as ai_router` then `app.include_router(ai_router)`. Depends on `AIService`, the Pydantic models, and `list_models` from the registry.

---

## `context_builder.py`

Aggregates structured data from six domains into a single context dict. Every domain (except `user`) is wrapped in a standard envelope:

```python
{"available": bool, "source": str | None, "data": dict | None}
```

| Domain | Builder Method | Data Expected |
|---|---|---|
| user | `_build_user_context()` | `message`, `conversation_id`, `session_id` |
| market | `_build_market_context()` | Price series or quotes |
| strategy | `_build_strategy_context()` | Config and parameters |
| backtest | `_build_backtest_context()` | Trade logs, equity curves |
| metrics | `_build_metrics_context()` | Sharpe, drawdown, win rate |
| portfolio | `_build_portfolio_context()` | Positions, cash balances |

The user domain breaks the envelope pattern — it always returns exactly `message`, `conversation_id`, `session_id` so the PromptBuilder can extract the query without an extra nesting level.

**Public entry point:** `build_context(user_data, market_data, ..., sources)`. The older `build()` wrapper passes `user_data=None`.

After assembling domains, the builder appends metadata: `generated_at` (UTC ISO 8601), `total_domains`, `populated_domains`, and `domains_with_data` — useful for logging and downstream analytics.

The envelope design means the PromptBuilder can check `domain["available"]` without knowing the shape of the data. Only stdlib `datetime` is needed.

**Consumed by:** `service.py`.

---

## `prompt_builder.py`

Assembles the seven-section prompt string sent to every LLM call. Sections are separated by 60-character `=` dividers:

1. **SYSTEM IDENTITY** — Persona ("TradeRetro AI") plus specialization and role boundaries
2. **CORE BEHAVIOUR RULES** — Hard integrity constraints (no fabrication, no speculation)
3. **QUANTITATIVE ANALYSIS RULES** — Relationship principles, per-metric interpretation guidance held in `METRIC_INTERPRETATION_GUIDES` (Net Profit, Total Return, Max Drawdown, Sharpe, Sortino, Win Rate, Profit Factor, Trade Count, Average Trade, Hold Period, Volatility, Risk vs Return, Equity Curve), cross-metric combination guidance held in `CROSS_METRIC_REASONING_GUIDES` (e.g. High Return + High Drawdown, Low Win Rate + Positive Profit, High Trade Count + Weak Returns), and strategy-family profiles held in `STRATEGY_REASONING_GUIDES` (SMA/EMA Crossover, Trend Following, Momentum, Mean Reversion, RSI, Breakout, Volatility-based, plus project types MACD, Bollinger Breakout, Donchian Breakout)
4. **REASONING FRAMEWORK** — Standard response flow (Summary → Observations → Interpretation → Risk → Strengths → Weaknesses → Suggestions → Limitations)
5. **FORMATTING RULES** — Markdown, headings, concise professional documentation style
6. **CONTEXT DATA** — Each domain rendered as `[Label] (Source: ...)` with data or "Data Not Available"
7. **USER QUESTION** — Extracted from the context's `user.message`

Unavailable domains show "Data Not Available" rather than being omitted. This keeps the prompt structure predictable and signals to the model that certain data genuinely wasn't provided, reducing hallucination risk.

**Primary API:** `build_prompt(context)`. The older `build(user_query, context)` injects the query into the context dict before delegating.

Each numbered section is assembled by a dedicated private helper (`_build_system_identity`, `_build_core_behaviour_rules`, `_build_quantitative_analysis_rules`, `_build_reasoning_framework`, `_build_formatting_rules`, `_build_context`, `_build_user_prompt`) and wrapped with the shared `_section(title, body)` method, which emits the 60-character `=` dividers. This keeps the structure easy to extend for future milestones.

Only stdlib `copy` is required. The module is consumed exclusively by `service.py`.

---

## `provider_factory.py`

Resolves a model ID or provider name to a `BaseLLMProvider` instance. Resolution order:

1. Look up the key in `registry.resolve_model()` → get provider type + model ID
2. If not found in the registry, treat the key as a direct provider name
3. For `"openai-compatible"`, pass `model`, `base_url`, `api_key` from `AIConfig`
4. For all others, instantiate with no arguments
5. `ValueError` if the provider type isn't in `_provider_classes`

```python
_provider_classes = {
    "mock": MockLLMProvider,
    "ollama": OllamaProvider,
    "gemini": GeminiProvider,
    "openai": OpenAIProvider,
    "openai-compatible": OpenAICompatibleProvider,
}
```

This is a closed set by design — the supported providers are known at compile time, not a dynamic plugin system. Adding a new provider means adding to both this map and the registry.

**Depends on:** `AIConfig`, `BaseLLMProvider`, all provider classes, `registry.resolve_model`.  
**Called by:** `service.py`, `llm_provider.py`.

---

## `registry.py`

Maintains the model catalog. Each entry is a `ModelInfo` dataclass: `id`, `display_name`, `provider`, `local: bool`.

The static dict `REGISTERED_MODELS` holds 13 entries spanning mock, Ollama, Gemini, OpenAI, and openai-compatible providers. At query time, `discover_ollama_models()` pings `http://localhost:11434/api/tags` and merges any locally installed Ollama models into the registry (existing entries are not overwritten). If Ollama isn't reachable, it logs a debug message and returns only the static set — no exception propagates.

Two public functions:

- `list_models()` — returns every known model as a flat list
- `resolve_model(model_id)` — looks up by ID with Ollama fallback, raises `KeyError` if not found

Requires `httpx` for the Ollama HTTP call. Used by `router.py` (listing) and `provider_factory.py` (resolution).

---

## `ollama_provider.py`

Calls a local Ollama instance via `POST {base_url}/api/generate` with `{"model", "prompt", "stream": false}`. Constructor accepts `model` (default `"llama3.2"`), `base_url` (default `http://localhost:11434`), and `timeout_seconds` (default 60).

Errors map to structured JSON responses: 404 includes `ollama pull` instructions, `ConnectError` tells the caller Ollama isn't running, `TimeoutException` flags slow generation. Returns `{"provider": "ollama", "model", "success", "response", "error", "tokens_used": null}`.

Depends on `httpx` and `BaseLLMProvider`.

---

## `llm_provider.py` (Deprecated)

Backward-compatibility shim. `LLMProviderFactory` delegates to `AIProviderFactory` so imports from the earlier provider design keep working. Re-exports `BaseLLMProvider`, `MockLLMProvider`, and `LLMProviderFactory`. New code should import from `ai.provider_factory` directly.

---

## `models/chat.py`

Pydantic v2 schemas for the API surface.

**Request models:**

| Model | Fields |
|---|---|
| `Message` | `role: str`, `content: str` |
| `ChatRequest` | `messages: List[Message]`, `context: Optional[dict]` |
| `GenerateRequest` | `user_query: str`, `provider_name: str` (default `"qwen2.5-coder-1.5b-instruct"`), `market_data`, `strategy_data`, `backtest_data`, `metrics_data`, `portfolio_data` (all `Optional[dict]`) |

**Response models:**

| Model | Fields |
|---|---|
| `GenerateResponse` | `success: bool`, `provider: str`, `user_query: str`, `prompt: str`, `context: Optional[dict]`, `response: Optional[dict]`, `error: Optional[str]` |
| `AIHealthResponse` | `module: str` (default `"ai"`), `status: str` (default `"initialized"`) |
| `ChatResponse` | `message: Message`, `usage: Optional[dict]` |

Only `GenerateRequest`, `GenerateResponse`, and `AIHealthResponse` are wired to endpoints today. `ChatRequest` and `ChatResponse` are defined for future conversational endpoints.

---

## Provider Implementations (`providers/`)

### `base_provider.py`

The contract every provider must implement:

```python
class BaseLLMProvider(ABC):
    @abstractmethod
    def generate_response(self, prompt: str) -> str: ...
```

### `mock_provider.py`

Deterministic provider for offline testing. Ignores the prompt entirely and returns:

```json
{
    "provider": "mock",
    "success": true,
    "response": "Mock response generated successfully.",
    "tokens_used": 0
}
```

Useful for validating the pipeline without a live model.

### `openai_compatible_provider.py`

The primary working provider. Talks to any OpenAI-compatible `/v1/chat/completions` endpoint — LM Studio, vLLM, TGI, etc.

| Detail | Value |
|---|---|
| Endpoint | `POST {base_url}/v1/chat/completions` |
| Payload | `{"model", "messages": [{"role": "user", "content": prompt}], "stream": false}` |
| Auth | Bearer token from `api_key` (default `"not-needed"`) |
| Token tracking | Extracts `usage.prompt_tokens`, `completion_tokens`, `total_tokens` |
| Timeout | 120s (generous for local LLMs on consumer hardware) |

Error handling covers model-not-loaded (404), connection refused, timeout, empty content, and missing choices. Each returns a structured JSON error.

### `openai_provider.py` (Stub)

Returns `{"provider": "openai", "success": false, "error": "OpenAI provider is not yet implemented", "response": null}`.

### `gemini_provider.py`

Working Gemini provider targeting the Gemini Flash model family (default `"gemini-3.6-flash"`). Calls `POST {base_url}/v1beta/models/{model}:generateContent?key={api_key}` with a `contents` payload. Returns the joined text from `candidates[0].content.parts` and token counts from `usageMetadata`. Error handling covers missing API key, authentication failure (HTTP 401/403), model not found, connection refused, timeout, no candidates, and empty text — each returns a structured JSON error.

---

## Prompt Templates (`prompts/`)

Three markdown files (`risk.md`, `metrics.md`, `strategy.md`) are stubs with header comments only (e.g., `"# Risk Assessment System Prompt\n\nThis is a placeholder..."`). Nothing in the codebase reads them today — the active system prompt is hardcoded in `PromptBuilder`.
