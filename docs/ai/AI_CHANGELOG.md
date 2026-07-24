# AI Changelog

All notable changes to the TradeRetro AI Copilot module.

## 1.0.0 (2026-07-25)

### Added

- **API** — `GET /api/ai/health`, `GET /api/ai/models`, `POST /api/ai/generate` mounted under `main.py`
- **Orchestration** — `AIService` coordinating context assembly, prompt construction, and LLM calls with structured error handling and JSON response parsing
- **Context Builder** — 6-domain context assembly (user, market, strategy, backtest, metrics, portfolio) with envelope pattern, metadata generation, and source tagging
- **Prompt Builder** — 4-section prompt (system instruction, context data, output rules, user question) with persona constraints and hallucination guards
- **Provider System** — `BaseLLMProvider` interface with `MockLLMProvider`, `OpenAICompatibleProvider`, `OllamaProvider`, plus `OpenAIProvider` and `GeminiProvider` stubs
- **Provider Factory** — Registry-backed provider resolution with `AIConfig` wiring for openai-compatible connections
- **Model Registry** — 14 static model entries across 5 provider types, dynamic Ollama discovery at query time
- **Configuration** — `AIConfig` dataclass (temperature 0.2, 1024 max tokens, LM Studio on port 1234) with validated `AIConfigurationManager`
- **Pydantic Models** — `GenerateRequest`, `GenerateResponse`, `AIHealthResponse` for the API surface; `Message`, `ChatRequest`, `ChatResponse` defined for future use
- **Backward Compatibility** — `LLMProviderFactory` delegating to `AIProviderFactory`
- **Prompt Templates** — Placeholder files for risk, metrics, and strategy prompts
- **Integration** — Router mounted at `/api/ai`, `httpx` added to requirements, CORS enabled

### Known Limitations

- No frontend integration — endpoints mounted but not consumed by React UI
- No streaming — all generation is synchronous
- No authentication on AI endpoints
- No conversation memory
- Cloud provider stubs (OpenAI, Gemini) return not-implemented errors
- Prompt template files are placeholders, not loaded at runtime
- No dedicated AI tests in the test suite
- AI configuration is hardcoded with no environment variable overrides
