# AI Future Roadmap

This document describes completed milestones and planned improvements to the AI module. Items are organized by time horizon. Features listed under "Completed" are implemented; everything else is future work.

## Completed (Tasks 02A–04B)

### Frontend Integration
- ✅ Copilot chat panel added to the React UI (`client/src/components/copilot/`)
- ✅ Chat panel wired to `POST /api/ai/generate` via `aiService.js`
- ✅ Markdown-rendered responses in the chat UI (`react-markdown` + `remark-gfm`)
- ✅ Automatic context injection — live backtest state is attached to every Copilot request via `aiContextBuilder.js`

### Automated Tests
- ✅ Comprehensive AI test suite: 229 AI tests across the router, service, config, context builder, prompt builder, providers, and provider factory (339 tests in the full suite)
- ✅ Coverage for error paths (connection refused, timeout, unknown provider, validation errors)

### Cloud Providers
- ✅ Gemini provider implemented (`gemini-3.6-flash`, `generateContent` REST API), configured via `GEMINI_API_KEY` / `GEMINI_MODEL` / `GEMINI_BASE_URL`

## Short-Term (Next 1–2 Milestones)

### Streaming Support
- Implement Server-Sent Events (SSE) for token-by-token streaming
- Add a new streaming endpoint (e.g., `POST /api/ai/generate/stream`)
- Update the frontend chat to consume streaming responses for real-time display

### Broader Configuration & Overrides
- Support overriding broader `AIConfig` fields via environment variables for local provider settings (e.g., LM Studio port, base URLs, default sampling parameters)
- Per-provider configuration profiles (different timeouts, base URLs, models per provider instance)
- Runtime configuration API to read/update settings dynamically

### Enhanced Prompt & Quick-Action Suggestions
- Add dynamic prompt suggestions in empty state based on active backtest metrics and strategy type
- Expand quick-action templates with domain-specific deep-dive shortcuts

## Medium-Term (Next 3–5 Milestones)

### Conversation Memory
- Add session-based conversation history storage (Redis or in-memory)
- Maintain a rolling window of recent messages per session
- Include conversation history in the prompt for context

### OpenAI Provider Implementation
- Implement the OpenAI provider with a real API key and `openai` Python SDK
- Add API key management (store, validate, rotate keys)
- Add cloud/local toggle in the frontend settings

### Prompt Template System
- Load prompt templates from the `ai/prompts/` directory
- Support domain-specific templates (risk analysis, strategy review, metrics explanation)
- Allow template selection via the API request

### Provider Configuration Profiles
- Add per-provider configuration objects (different timeouts, base URLs, models)
- Support multiple LM Studio/Ollama instances with different profiles

## Long-Term (Future)

### Authentication & Rate Limiting
- Add API key authentication for AI endpoints
- Support per-user configuration and usage tracking
- Implement rate limiting per user/API key

### Retrieval-Augmented Generation (RAG)
- Integrate a vector database (e.g., Qdrant, Chroma, pgvector)
- Index backtest reports, strategy documentation, and market research
- Automatically retrieve relevant documents when generating responses

### Response Validation
- Implement output schema validation
- Add content filtering for harmful or prohibited outputs
- Implement prompt injection detection and sanitization

### Configuration API
- Expose `AIConfigurationManager` via REST API endpoints
- Allow runtime configuration changes without code deployment
- Persist configuration changes to disk or database

### Tool Calling
- Support function calling to query database or fetch live data
- Enable the LLM to run backtests or retrieve market data through approved endpoints
