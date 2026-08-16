# AI Changelog

All notable changes to the TradeRetro AI Copilot module.

## 1.2.1 (2026-08-08)

Release polish: model selection UI, environment variable configuration, and expanded test coverage.

### Added

- **Model Selection UI** — Added model configuration support via `ModelPickerDropdown.jsx` (and `ModelSelector.jsx` wrapper) hosted in the Copilot header and settings modal (`SettingsModal.jsx`), populated from `GET /api/ai/models`. The selected model is persisted in the Zustand store and sent as `provider_name` on generate requests, overriding the server default.
- **Environment Variable Configuration** — `ai/config.py` now loads `.env` best-effort (via `python-dotenv` when installed; import failure is silently ignored). `GEMINI_API_KEY`, `GEMINI_MODEL`, and `GEMINI_BASE_URL` overrides are applied when `AIConfig` is constructed.
- **Tests** — `test_ai_config.py` added for env-var overrides and `AIConfigurationManager` validation; provider and factory suites expanded. The AI suite now stands at **229 tests across 7 files**.
- **Documentation** — Registry, configuration, testing, limitations, roadmap, and changelog docs synchronized with the current implementation.

## 1.2.0 (2026-08-07)

This release replaces the Gemini stub with a production-ready Gemini provider.

### Added

- **GeminiProvider** — `ai/providers/gemini_provider.py` now calls Google's Gemini `generateContent` REST API, targeting the current recommended Gemini Flash model `gemini-3.6-flash`. Structured error handling covers missing API key, authentication failure (HTTP 401/403), model not found, connection refused, timeout, no candidates, and empty text. Token tracking via `usageMetadata`.
- **Gemini Configuration** — `AIConfig` gains `gemini_api_key`, `gemini_model`, and `gemini_base_url`, each defaulting to the `GEMINI_API_KEY`, `GEMINI_MODEL`, and `GEMINI_BASE_URL` environment variables (loadable from `.env`).
- **Factory Wiring** — `AIProviderFactory` resolves Gemini exactly like the other providers, passing model, api key, and base URL from `AIConfig`.
- **Registry** — `gemini-3.6-flash` (display name "Gemini Flash") registered as a `gemini` provider entry (13 static entries total). Frontend only sees display names.
- **Environment Template** — `.env.example` documents `GEMINI_API_KEY`, `GEMINI_MODEL`, and `GEMINI_BASE_URL`.
- **REPORT Mode & Report Registry** — Analysis mode infrastructure (`ai/mode.py`) plus a report registry for structured analysis; prompt builder hardened with report-mode section generation for `MODE_REPORT` requests.
- **Tests** — Gemini provider tests covering success, authentication failure, timeout, malformed response, provider unavailable, and empty/missing API key; factory wiring and config env-override tests. Full backend suite now at 339 collected tests.

### Changed

- **Documentation** — Registry, provider system, configuration, backend, testing, limitations, architecture, roadmap, and changelog docs updated to reflect the working Gemini provider.

### Unchanged

- `ContextBuilder`, the router, and `AIService` architecture are unchanged; the OpenAI stub is untouched. No streaming, memory, tool calling, images, voice, agents, RAG, new endpoints, or new UI.

## 1.1.0 (2026-08-06)

This release delivers frontend integration, context injection, prompt-engineering
enhancements, and the automated AI test suite. The endpoint contract and provider
architecture from 1.0.0 are unchanged.

### Task 02A — Backend Foundation (2026-07-24)

#### Added

- **AI Module Scaffolding** — `python-engine/ai/` package initialized with configuration, models, and service structure
- **API Surface** — `GET /api/ai/health`, `GET /api/ai/models`, `POST /api/ai/generate` mounted under `main.py`
- **Pydantic Models** — Typed `GenerateRequest`, `GenerateResponse`, `AIHealthResponse` request/response schemas
- **Generation Endpoint** — Initial stub generate endpoint wired to the FastAPI application

### Task 02B — Full Backend & Provider Architecture (2026-07-25)

#### Added

- **Orchestration** — `AIService` coordinating context assembly, prompt construction, and LLM calls with structured error handling and JSON response parsing
- **Context Builder** — 6-domain context assembly (user, market, strategy, backtest, metrics, portfolio) with envelope pattern, metadata generation, and source tagging
- **Prompt Builder** — System persona, behaviour rules, quantitative analysis rules, reasoning framework, formatting rules, context rendering, and user question assembly
- **Provider System** — `BaseLLMProvider` interface with working `MockLLMProvider`, `OpenAICompatibleProvider`, `OllamaProvider`, plus `OpenAIProvider` and `GeminiProvider` stubs
- **Provider Factory** — Registry-backed provider resolution with `AIConfig` wiring for openai-compatible connections
- **Model Registry** — 13 static model entries across 5 provider types, dynamic Ollama discovery at query time
- **Configuration** — `AIConfig` dataclass (temperature 0.2, 1024 max tokens, LM Studio on port 1234) with validated `AIConfigurationManager`
- **Backward Compatibility** — `LLMProviderFactory` delegating to `AIProviderFactory`; legacy `build()` wrappers on both builders
- **Documentation** — Initial AI documentation suite (`docs/ai/`)

### Task 03 — Frontend Integration (2026-07-26)

#### Added

- **Copilot Panel** — Chat panel in the React Dashboard (`CopilotPanel` and subcomponents under `client/src/components/copilot/`) with conversation list, message bubbles, loading states, and empty state
- **Markdown Rendering** — Rich markdown responses rendered via `react-markdown` + `remark-gfm` with code blocks, tables, and blockquote styling
- **Prompt Input** — Autosizing textarea with Enter-to-send, quick actions, and clear-conversation controls
- **Client Service** — `aiService.js` wrapping `POST /api/ai/generate` through the shared `apiClient.js`
- **State Management** — `useAIStore` Zustand store managing panel visibility, messages, loading, and error state

### Task 04A — Context-Aware Request Pipeline (2026-07-26)

#### Added

- **Frontend Context Injection** — `aiContextBuilder.js` normalizes live backtest store state (strategy, market, backtest, metrics) into the AI request payload; only populated sections are sent
- **Backend Context Assembly** — `ContextBuilder` envelope pattern with availability flags, source tagging, and metadata (generated_at, domain counts)
- **End-to-End Context Propagation** — Copilot requests carry real backtest context from the UI through the API into the prompt

### Task 04B — Prompt Engineering (2026-08-06)

#### Changed

- **Modular Quantitative Sections** — Prompt Builder reorganized into independent quantitative analysis blocks with a shared guide-block renderer
- **Metric Interpretation Guidance** — `METRIC_INTERPRETATION_GUIDES` registry covering 13 metrics (Net Profit, Total Return, Maximum Drawdown, Sharpe, Sortino, Win Rate, Profit Factor, Trade Count, Average Trade, Average Hold Period, Volatility, Risk vs Return, Equity Curve)
- **Cross-Metric Reasoning** — `CROSS_METRIC_REASONING_GUIDES` registry with 11 combination guides plus synthesis principles
- **Strategy-Aware Reasoning** — `STRATEGY_REASONING_GUIDES` registry with 11 strategy-family profiles (incl. project types MOVING_AVERAGE_CROSSOVER, RSI, MACD, BOLLINGER_BREAKOUT, DONCHIAN_BREAKOUT)

### Task 04B.5 — Milestone 1: AI Test Suite (2026-08-06)

#### Added

- **Automated AI Test Suite** — 169 hermetic tests across 6 files (`test_ai_router.py`, `test_ai_service.py`, `test_ai_context_builder.py`, `test_ai_prompt_builder.py`, `test_ai_providers.py`, `test_ai_provider_factory.py`); full suite stands at **279 tests, all passing**
- **Contract Regression Protection** — Tests lock the 7-section prompt structure, context envelope schema, provider structured-error contract, and the `400 VALIDATION_ERROR` router response

### Resolved in 1.1.0

The following 1.0.0 limitations are resolved: no frontend integration, no
dedicated AI tests, and prompt templates being the only prompt surface (the
7-section system prompt in code is now test-locked). Genuine remaining
limitations are tracked in [AI_LIMITATIONS.md](AI_LIMITATIONS.md).

---

## 1.0.0 (2026-07-25)

### Added

- **API** — `GET /api/ai/health`, `GET /api/ai/models`, `POST /api/ai/generate` mounted under `main.py`
- **Orchestration** — `AIService` coordinating context assembly, prompt construction, and LLM calls with structured error handling and JSON response parsing
- **Context Builder** — 6-domain context assembly (user, market, strategy, backtest, metrics, portfolio) with envelope pattern, metadata generation, and source tagging
- **Prompt Builder** — 4-section prompt (system instruction, context data, output rules, user question) with persona constraints and hallucination guards (superseded by the 7-section prompt in Task 04B)
- **Provider System** — `BaseLLMProvider` interface with `MockLLMProvider`, `OpenAICompatibleProvider`, `OllamaProvider`, plus `OpenAIProvider` and `GeminiProvider` stubs
- **Provider Factory** — Registry-backed provider resolution with `AIConfig` wiring for openai-compatible connections
- **Model Registry** — 13 static model entries across 5 provider types, dynamic Ollama discovery at query time
- **Configuration** — `AIConfig` dataclass (temperature 0.2, 1024 max tokens, LM Studio on port 1234) with validated `AIConfigurationManager`
- **Pydantic Models** — `GenerateRequest`, `GenerateResponse`, `AIHealthResponse` for the API surface; `Message`, `ChatRequest`, `ChatResponse` defined for future use
- **Backward Compatibility** — `LLMProviderFactory` delegating to `AIProviderFactory`
- **Prompt Templates** — Placeholder files for risk, metrics, and strategy prompts
- **Integration** — Router mounted at `/api/ai`, `httpx` added to requirements, CORS enabled