# TradeRetro AI Copilot — Current Architecture Report

**Date:** 2026-07-24  
**Branch:** `feature/ai-copilot`  
**Author:** SkYhAWk1411  
**Audit type:** Architecture review (no code changes)

---

## 1. Executive Summary

The AI Copilot module is in **early scaffolding stage**.

**What has been built:**
- A complete **backend-only** AI package (`python-engine/ai/`) with 15 source files (~612 lines).
- All core abstractions are defined: typed models, router, service orchestrator, context builder, prompt builder, provider abstraction, mock provider, and configuration manager.
- The router is registered with the FastAPI application at `/api/ai`.
- One endpoint exists: `GET /api/ai/health` — returns a static health response.

**Current implementation maturity:** Initial skeleton. All components compile and import cleanly. The module is isolated and the existing backend is untouched.

**Current architectural stage:** **Foundation laid; pipeline not wired.** The service layer (`AIService`) and router exist but are not connected — no POST endpoint calls the service. The prompt pipeline (context → prompt → provider → response) is structurally complete in code but never executed at runtime.

**What is intentionally incomplete:**
- No POST endpoints (`/chat`, `/generate`) are wired.
- `AIService.generate_response()` is never invoked.
- No real LLM provider (OpenAI, Anthropic, etc.) is implemented — only `MockLLMProvider`.
- No streaming support.
- No authentication, rate limiting, or user session management.
- No frontend integration (client has zero AI references).
- No tests.

---

## 2. Folder Structure

```
python-engine/ai/
├── __init__.py                  # Package marker with docstring
├── config.py                    # AIConfig dataclass + AIConfigurationManager
├── context_builder.py           # ContextBuilder — aggregates market/strategy/backtest/etc. data
├── llm_provider.py              # LLMProviderFactory — provider registry + instantiation
├── prompt_builder.py            # PromptBuilder — assembles system + context + user prompt
├── router.py                    # FastAPI router (/api/ai prefix)
├── service.py                   # AIService — orchestrates ContextBuilder → PromptBuilder → Provider
├── models/
│   ├── __init__.py              # Package marker
│   └── chat.py                  # Pydantic models: Message, ChatRequest, ChatResponse,
│                                #   GenerateRequest, GenerateResponse, AIHealthResponse
├── prompts/
│   ├── metrics.md               # Placeholder: performance metrics system prompt
│   ├── risk.md                  # Placeholder: risk assessment system prompt
│   └── strategy.md              # Placeholder: strategy analysis system prompt
└── providers/
    ├── __init__.py              # Exports BaseLLMProvider, MockLLMProvider
    ├── base_provider.py         # Abstract base class (ABC) for LLM providers
    └── mock_provider.py         # MockLLMProvider — deterministic fake responses
```

### File Purposes

| File | Purpose |
|---|---|
| `__init__.py` | Package namespace; docstring only |
| `config.py` | Holds AI module configuration (provider, temperature, max_tokens, etc.) with a manager for mutation and validation |
| `context_builder.py` | Aggregates data from five domains (market, strategy, backtest, metrics, portfolio) into a structured context dict for the LLM |
| `llm_provider.py` | Factory pattern — maps provider names to provider classes; currently only "mock" is registered |
| `prompt_builder.py` | Assembles a full prompt string from system instruction, contextual data, and user query |
| `router.py` | FastAPI router defining AI endpoints; currently only has `GET /health` |
| `service.py` | Orchestration layer that chains ContextBuilder → PromptBuilder → LLM provider |
| `models/chat.py` | All Pydantic request/response models for the AI API surface |
| `prompts/*.md` | Placeholder markdown files for future domain-specific system prompts |
| `providers/base_provider.py` | Abstract interface with `generate_response(prompt) -> str` |
| `providers/mock_provider.py` | Deterministic mock returning a static JSON string; used for offline validation |

---

## 3. Module Responsibilities

### `config.py`
- **Responsibility:** Manage AI Copilot configuration parameters.
- **Public classes:** `AIConfig` (dataclass), `AIConfigurationManager`
- **Public functions (methods):** `get_config()`, `set_provider()`, `set_temperature()`, `set_max_tokens()`, `reset_defaults()`
- **Dependencies:** None (stdlib `dataclasses` only).
- **Not responsible for:** Loading config from environment/files; reading secrets; provider lifecycle.

### `context_builder.py`
- **Responsibility:** Aggregate and standardize structured context from five trading domains into a unified dict for prompt construction.
- **Public classes:** `ContextBuilder`
- **Public functions:** `build()`, `build_market_context()`, `build_strategy_context()`, `build_backtest_context()`, `build_metrics_context()`, `build_portfolio_context()`
- **Dependencies:** None (stdlib `typing` only).
- **Not responsible for:** Fetching data from databases or APIs; data transformation or enrichment; caching.

### `prompt_builder.py`
- **Responsibility:** Assemble a complete LLM prompt string from system instructions, context data, and user query.
- **Public classes:** `PromptBuilder`
- **Public functions:** `build()`, `build_system_prompt()`, `build_user_prompt()`, `build_context_prompt()`
- **Dependencies:** None (stdlib `typing` only).
- **Not responsible for:** Token counting; model-specific formatting; template file I/O.

### `llm_provider.py`
- **Responsibility:** Act as a factory for LLM provider instances.
- **Public classes:** `LLMProviderFactory`
- **Public functions:** `get_provider()`
- **Dependencies:** `ai.providers.base_provider`, `ai.providers.mock_provider`
- **Not responsible for:** Provider caching/connection pooling; API key management.

### `service.py`
- **Responsibility:** Orchestrate the full AI generation pipeline: context → prompt → provider → parsed response.
- **Public classes:** `AIService`
- **Public functions:** `generate_response()`
- **Dependencies:** `ContextBuilder`, `PromptBuilder`, `LLMProviderFactory`
- **Not responsible for:** API routing; authentication; rate limiting; response serialization (returns dict, not Pydantic model).

### `router.py`
- **Responsibility:** Expose AI Copilot functionality as REST endpoints.
- **Public classes:** None (module-level `router = APIRouter(...)`)
- **Public functions:** `health()` (async)
- **Dependencies:** FastAPI `APIRouter`, `AIHealthResponse` model
- **Not responsible for:** Business logic orchestration; provider selection; streaming.

### `providers/base_provider.py`
- **Responsibility:** Define the abstract interface all LLM providers must implement.
- **Public classes:** `BaseLLMProvider`
- **Public functions:** `generate_response()` (abstract)
- **Dependencies:** `abc`
- **Not responsible for:** Any concrete implementation details.

### `providers/mock_provider.py`
- **Responsibility:** Provide deterministic fake LLM responses for offline testing and development.
- **Public classes:** `MockLLMProvider`
- **Public functions:** `generate_response()`
- **Dependencies:** `BaseLLMProvider`, `json`
- **Not responsible for:** Network calls; real model inference.

### `models/chat.py`
- **Responsibility:** Define typed Pydantic models for all AI API request/response contracts.
- **Public classes:** `Message`, `ChatRequest`, `ChatResponse`, `GenerateRequest`, `GenerateResponse`, `AIHealthResponse`
- **Dependencies:** `pydantic.BaseModel`, `Field`
- **Not responsible for:** Validation beyond type constraints; database persistence.

---

## 4. Current Request Flow

```
Client / HTTP
     │
     ▼
FastAPI Application (main.py)
     │
     ├── Router registration: app.include_router(ai_router)
     │
     ▼
ai.router (/api/ai)
     │
     ├── GET /health ───────────────► AIHealthResponse (static)
     │
     └── POST /chat       ❌ NOT WIRED (model exists, no route)
     └── POST /generate    ❌ NOT WIRED (model exists, no route)
                   
Flow STOPS HERE.

The intended (but unimplemented) pipeline would be:

     POST /generate
          │
          ▼
     router.generate()  [does not exist]
          │
          ▼
     AIService.generate_response()
          │
          ├── ContextBuilder.build()
          ├── PromptBuilder.build()
          ├── LLMProviderFactory.get_provider() → BaseLLMProvider
          └── provider.generate_response(prompt)
               │
               ▼
          Parse JSON → GenerateResponse
```

**Current flow stops at the router.** The `GET /health` endpoint returns immediately with a static response. No POST routes are defined, so `AIService` is never called at runtime.

---

## 5. Completed Components

| Component | Status | What it does |
|---|---|---|
| **AI package** | ✅ Complete | `python-engine/ai/` with `__init__.py` and full module structure |
| **Pydantic models** | ✅ Complete | `ChatRequest`, `ChatResponse`, `GenerateRequest`, `GenerateResponse`, `AIHealthResponse`, `Message` — all typed and field-annotated |
| **Router** | ✅ Complete (partial) | `APIRouter(prefix="/api/ai")` registered in `main.py` with one working endpoint |
| **Health endpoint** | ✅ Complete | `GET /api/ai/health` returns `AIHealthResponse(module="ai", status="initialized")` |
| **AIConfig** | ✅ Complete | Dataclass with 6 parameters (enabled, provider, temperature, max_tokens, timeout_seconds, debug) |
| **AIConfigurationManager** | ✅ Complete | Read/write/validate config; set provider, temperature, max_tokens; reset defaults |
| **ContextBuilder** | ✅ Complete | Aggregates 5 domain contexts with standardized `{available, source, data}` structure |
| **PromptBuilder** | ✅ Complete | Assembles system instruction + context sections + user query into a single prompt string |
| **Prompt templates (markdown)** | ✅ Complete (placeholders) | Three `.md` files for metrics, risk, strategy — each is a single-line placeholder |
| **BaseLLMProvider** | ✅ Complete | Abstract base class with `generate_response()` abstract method |
| **MockLLMProvider** | ✅ Complete | Deterministic provider returning static JSON `{"provider": "mock", "success": true, ...}` |
| **LLMProviderFactory** | ✅ Complete | Registers providers by name, instantiates on `get_provider()` |
| **Router registration** | ✅ Complete | `from ai.router import router as ai_router` + `app.include_router(ai_router)` in `main.py` |

---

## 6. Remaining Components

| Component | Status | Notes |
|---|---|---|
| **POST /chat endpoint** | ❌ Missing | `ChatRequest`/`ChatResponse` models exist; no route handler |
| **POST /generate endpoint** | ❌ Missing | `GenerateRequest`/`GenerateResponse` models exist; no route handler |
| **AIService integration (router → service)** | ❌ Missing | Router never imports or calls `AIService` |
| **Prompt pipeline execution** | ❌ Missing | `ContextBuilder.build()` → `PromptBuilder.build()` → provider is never invoked at runtime |
| **Provider invocation (non-mock)** | ❌ Missing | Only `MockLLMProvider` exists; no real provider (OpenAI, Anthropic, etc.) has been implemented |
| **API key / secrets management** | ❌ Missing | No env var reading, no secure credential loading for real providers |
| **Streaming response support** | ❌ Missing | All models and providers assume synchronous, complete responses |
| **Error handling middleware** | ❌ Missing | No AI-specific error handling; relies on global FastAPI handlers |
| **Authentication** | ❌ Missing | No auth on AI endpoints (other routes have auth via `routers/auth.py`) |
| **Rate limiting** | ❌ Missing | No per-user or per-IP rate limiting for AI calls |
| **Token usage tracking** | ❌ Missing | `GenerateResponse` has `usage` field but no tracking implementation |
| **Conversation history / session management** | ❌ Missing | `ChatRequest` has `messages` list but no persistence or state |
| **Frontend UI** | ❌ Missing | No AI Copilot component in `client/src/`; no React component, no API client |
| **Unit tests** | ❌ Missing | No test files exist for any AI module |
| **Integration tests** | ❌ Missing | No end-to-end test for the AI pipeline |
| **Prompt template loading** | ❌ Missing | `prompts/*.md` files exist but `PromptBuilder` does not read or use them |

---

## 7. API Surface

### `GET /api/ai/health`

| Property | Value |
|---|---|
| **Purpose** | Liveness check for the AI module |
| **Request model** | None (no body) |
| **Response model** | `AIHealthResponse { module: str = "ai", status: str = "initialized" }` |
| **Implementation status** | ✅ Fully implemented and registered |

### `POST /api/ai/chat` (planned — NOT IMPLEMENTED)

| Property | Value |
|---|---|
| **Purpose** | Multi-turn conversational AI assistant |
| **Request model** | `ChatRequest { messages: List[Message], context: Optional[dict] }` |
| **Response model** | `ChatResponse { message: Message, usage: Optional[dict] }` |
| **Implementation status** | ❌ Models exist. No route handler, no service wiring, no session state. |

### `POST /api/ai/generate` (planned — NOT IMPLEMENTED)

| Property | Value |
|---|---|
| **Purpose** | Single-turn structured generation with full trading context |
| **Request model** | `GenerateRequest { user_query, provider_name, market_data, strategy_data, backtest_data, metrics_data, portfolio_data }` |
| **Response model** | `GenerateResponse { success, provider, user_query, prompt, context, response, error }` |
| **Implementation status** | ❌ Models exist. No route handler. `AIService.generate_response()` returns a `Dict`, not a `GenerateResponse`. |

### Real provider endpoints (planned — NOT IMPLEMENTED)

No OpenAI, Anthropic, or other real model endpoints exist. Only `MockLLMProvider` is registered in the factory.

---

## 8. Dependency Graph

```
┌─────────────────────────────────────────────────────┐
│                   main.py                           │
│  app.include_router(ai_router)                      │
└────────────────────┬────────────────────────────────┘
                     │ imports
                     ▼
┌─────────────────────────────────────────────────────┐
│              router.py (APIRouter)                   │
│  prefix="/api/ai"  tag="AI"                         │
│  ┌───────────────────────────────────────────────┐   │
│  │ GET /health → AIHealthResponse (static)       │   │
│  │ POST /chat          ❌ NOT WIRED               │   │
│  │ POST /generate      ❌ NOT WIRED               │   │
│  └───────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────┘
                     │ should call (NOT YET WIRED)
                     ▼
┌─────────────────────────────────────────────────────┐
│              service.py (AIService)                  │
│  generate_response()                                 │
│    1. context_builder.build(...)                     │
│    2. prompt_builder.build(query, context)           │
│    3. provider_factory.get_provider(name)            │
│    4. provider.generate_response(prompt)             │
│    5. json.loads(response) → return dict             │
└───────┬──────────────┬──────────────┬───────────────┘
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│context_      │ │prompt_       │ │llm_provider.py   │
│builder.py    │ │builder.py    │ │LLMProviderFactory │
│ContextBuilder│ │PromptBuilder │ │  _providers = {  │
│  build()     │ │  build()     │ │    "mock": ...   │
└──────────────┘ └──────────────┘ │  }               │
                                  │  get_provider()  │
                                  └────────┬─────────┘
                                           │
                                  ┌────────▼─────────┐
                                  │ base_provider.py │
                                  │ BaseLLMProvider  │
                                  │ (ABC)            │
                                  └────────┬─────────┘
                                           │ implements
                                  ┌────────▼─────────┐
                                  │ mock_provider.py │
                                  │ MockLLMProvider  │
                                  │ static JSON resp │
                                  └──────────────────┘

*** Intentionally missing dependencies ***
  - router.py does NOT import or call service.py
  - service.py does NOT return GenerateResponse (returns raw dict)
  - No provider → real API/network dependency exists
  - No auth middleware depends on AI router
  - No frontend component depends on any AI endpoint
```

---

## 9. Architecture Evaluation

### Designed well
- **Clean separation of concerns** — Config, context, prompts, providers, and orchestration are in separate files with single responsibilities.
- **Abstract provider interface** — `BaseLLMProvider` uses Python ABC, making real provider integration a matter of subclassing.
- **Factory pattern for providers** — `LLMProviderFactory` allows runtime provider selection without callers knowing concrete types.
- **Context standardization** — Each domain context uses a consistent `{available, source, data}` envelope, making downstream prompt building predictable.
- **Typed API contracts** — All request/response models use Pydantic v2 with `Field(description=...)` for self-documentation.
- **Isolation** — The AI module is a self-contained package with zero imports from `engine/` or `flows/`. It won't accidentally break trading logic.

### Code smells
1. **AIService returns `Dict[str, Any]` instead of `GenerateResponse`** — The service layer produces raw dicts that should be `GenerateResponse` instances. This breaks the type contract and shifts parsing burden to callers.
2. **`AIConfig` is not loaded from environment** — Hardcoded defaults with no mechanism to override via env vars or config files. Production would require this.
3. **Prompt templates (`prompts/*.md`) are unused** — Three markdown files exist but `PromptBuilder` hardcodes the system prompt in Python. The files are dead code.
4. **`ChatRequest` / `ChatResponse` models are disconnected** — These models exist but nothing in the current codebase references them (no route, no service method for chat).
5. **`provider_name` is `str` not an Enum** — Using raw strings for provider selection is fragile; a misspelling raises a `ValueError` at runtime.
6. **No async in service layer** — `generate_response()` is synchronous even though the router uses `async def`. A real provider would need network I/O.

### Should be improved later
- **Error handling granularity** — The service's blanket `except Exception` should distinguish between validation errors, provider errors, and parsing errors.
- **Dependency injection** — Currently hard-constructs defaults; a DI framework or explicit wiring would improve testability.
- **Logging** — Only one `logger.error()` call exists in the service layer. Debug logging throughout the pipeline would help diagnosis.
- **Token counting** — No mechanism to estimate or limit prompt/response token usage before calling the provider.

### Intentionally deferred
- Real provider integration (OpenAI, Anthropic)
- Streaming responses
- Authentication / rate limiting
- Frontend chat UI
- Prompt template loading from markdown files
- Session/conversation persistence

---

## 10. Technical Debt

### Minor
| Debt | Location | Detail |
|---|---|---|
| Unused imports | `service.py:9` | `import json` only used in try/except; could be scoped |
| Unused model `Message` | `models/chat.py` | Imported but only `AIHealthResponse` is used by router |
| Placeholder prompt files exist but are dead code | `prompts/*.md` | Three files, zero consumption |
| `__pycache__` directories tracked by gitignore | (build artifacts) | Not harmful, but should be globally ignored |
| No `__all__` in some `__init__.py` files | `models/__init__.py`, `__init__.py` | Missing explicit export lists |

### Medium
| Debt | Location | Detail |
|---|---|---|
| `AIService` returns `dict` not `GenerateResponse` | `service.py:91-98` | Type contract mismatch; callers must know dict structure |
| No env-driven config loading | `config.py` | `AIConfig` uses hardcoded defaults; no .env or settings.py integration |
| `provider_name` is a bare string | `llm_provider.py:19`, `models/chat.py:28` | Should be a `Literal` or `Enum` to prevent runtime errors |
| `generate_response()` is synchronous | `service.py:40` | Real providers need `async`; will require breaking change |
| Zero tests | everywhere | Entire AI module is untested; no CI coverage |

### Major
| Debt | Location | Detail |
|---|---|---|
| **Router has only a health check** | `router.py` | The core POST endpoints (`/chat`, `/generate`) are defined as models but have zero implementation |
| **Service is never invoked** | `router.py` → `service.py` | The entire pipeline (context → prompt → provider) is dead code at runtime |
| **No auth on AI endpoints** | `router.py` | Other backend routers (e.g. `backtest`) may have auth; AI has none, even when wired later |
| **No real provider implementation** | `providers/` | `MockLLMProvider` is the only registered provider — the system cannot generate real AI responses |

---

## 11. Future Roadmap

The remaining implementation order matters because each step depends on the previous one:

| Order | Task | Why this order |
|---|---|---|
| **1** | **Wire POST /generate endpoint** | Router → AIService connection is the single missing link for the basic pipeline. Everything else hangs off this. |
| **2** | **Return GenerateResponse from service** | Fix the type mismatch so the endpoint returns proper typed responses. |
| **3** | **Add POST /chat endpoint** | Multi-turn conversation depends on having the generate pipeline working first. |
| **4** | **Implement a real LLM provider (e.g., OpenAI)** | The mock is for development only; real functionality requires a real provider. Requires API key management (#5). |
| **5** | **Secrets/configuration for API keys** | Prerequisite for #4. Read from `.env` or environment. |
| **6** | **Add auth middleware to AI router** | Prevent unauthorized AI usage; align with existing auth pattern in the app. |
| **7** | **Add rate limiting** | Protect against abuse/cost overruns once real providers are in use. |
| **8** | **Unit tests for all AI modules** | Should be written as each module is built, but minimum coverage should exist before production use. |
| **9** | **Frontend AI Copilot component** | Requires the backend endpoints to be working and tested. |
| **10** | **Streaming response support** | Better UX for chat; requires async provider + SSE or WebSocket endpoint. |
| **11** | **Prompt template loading from .md files** | Enhances maintainability; non-urgent since system prompt is short and static. |
| **12** | **Token usage tracking & cost management** | Important before production deployment to avoid surprise bills. |

---

## 12. Git History

Four commits in scope (the only commits on `feature/ai-copilot` that touch AI files):

| Commit | Description | Files | What it introduced |
|---|---|---|---|
| `fb5d218` | **feat(ai): initialize AI copilot backend foundation** | 15 files (+582 lines) | **Initial scaffolding.** Created the entire `python-engine/ai/` package including `config.py`, `context_builder.py`, `prompt_builder.py`, `llm_provider.py`, `service.py`, all provider files, all model files, and placeholder prompt markdown files. Router with `GET /health` only. |
| `5ef9da4` | **feat(ai): register AI router with FastAPI application** | 2 files (+2 lines) | Added `from ai.router import router as ai_router` + `app.include_router(ai_router)` in `main.py`. Mounted the AI module into the live application. |
| `4634523` | **feat(ai): add typed Pydantic request and response models** | 2 files (+32/-7 lines) | Refined `models/chat.py` to add `ChatRequest`, `ChatResponse`, `GenerateRequest`, `GenerateResponse`, `AIHealthResponse` with full Pydantic field annotations and descriptions. Updated router to use `AIHealthResponse`. |
| `70a36ec` | **chore: ignore temporary OpenCode workspace** | 1 file (+3 lines) | Added `.opencode/` to `.gitignore` (housekeeping; unrelated to AI logic). |

**Observations:** No AI-related tests have ever been committed. No real provider has been introduced. No frontend AI code exists.

---

## 13. Safety Check

| Check | Status | Evidence |
|---|---|---|
| **AI module is isolated** | ✅ Pass | `python-engine/ai/` is self-contained. All imports are either stdlib, FastAPI, Pydantic, or internal (`ai.*`). No import from `engine/`, `flows/`, or `services/`. |
| **Trading engine not modified** | ✅ Pass | `git diff 77e9e5d..70a36ec` shows no changes to `python-engine/engine/`, `python-engine/flows/`, or `python-engine/pipeline/`. Only `main.py` gained a single `import` + `include_router`. |
| **API contracts preserved** | ✅ Pass | No existing endpoint was modified. New endpoints are under a new prefix `/api/ai`. No breaking changes to existing routes. |
| **Existing backend architecture not rewritten** | ✅ Pass | The AI module is additive. `main.py` gained 2 lines. No refactoring of existing routers, services, or data models. |

**No violations found.** The AI Copilot implementation is completely additive and non-invasive.

---

## 14. Overall Progress

**Estimated completion of AI backend module: 20–25%**

### What this percentage represents
This is the proportion of the **backend AI module** (not the full copilot feature, which includes frontend, auth, streaming, etc.).

**Breakdown of the 75–80% remaining:**

| Category | Weight | Done | Notes |
|---|---|---|---|
| Data models | 10% | 10% | Models are well-defined and complete |
| Configuration | 5% | 5% | Config class exists but has no env integration |
| Context builder | 10% | 10% | Complete abstraction, but never called at runtime |
| Prompt builder | 10% | 10% | Complete abstraction, but never called at runtime |
| Provider abstraction | 10% | 10% | Interface + mock done; no real provider |
| Service orchestration | 15% | 15% | Code exists but returns wrong type and is never invoked |
| **Router endpoints** | **15%** | **2%** | Only health check wired; POST endpoints are missing |
| **Router → Service wiring** | **10%** | **0%** | The critical connection does not exist |
| Real provider | 10% | 0% | Only mock exists |
| Testing | 5% | 0% | No tests |
| Total | 100% | **~22%** | |

**Do not inflate:** The module is structurally well-designed but functionally inactive. The pipeline compiles but cannot process a single user request.

---

## 15. Recommendations

### Next immediate task

**Wire `POST /api/ai/generate` to invoke `AIService.generate_response()` and return a `GenerateResponse`.**

### Why this task

1. **Unlocks the entire pipeline** — It connects the existing context builder → prompt builder → provider chain for the first time. All the architectural work in `service.py` becomes live.
2. **Smallest atomic step** — Requires adding ~30 lines to `router.py`:
   - Import `AIService` (or instantiate it)
   - Create a `async def generate(...)` handler accepting `GenerateRequest`
   - Call `service.generate_response(...)` and return `GenerateResponse`
3. **Enables testing** — With a live endpoint, `MockLLMProvider` can be validated end-to-end through HTTP.
4. **Unblocks all downstream work** — Frontend, chat endpoint, real provider, auth, and streaming all depend on a working generate endpoint.

### Completion criteria for this task

- `POST /api/ai/generate` returns HTTP 200 with a valid `GenerateResponse` JSON body.
- `AIService` converts its internal dict return to a `GenerateResponse` instance.
- `MockLLMProvider` response flows through the entire pipeline.
- Unit tests (or at minimum a manual curl) confirm the flow.
