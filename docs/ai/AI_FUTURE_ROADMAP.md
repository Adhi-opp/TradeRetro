# AI Future Roadmap

This document describes planned improvements to the AI module. Items are organized by time horizon. None of these features are implemented yet.

## Short-Term (Next 1–2 Milestones)

### Frontend Integration
- Add a Copilot chat panel to the React UI
- Wire the chat panel to `POST /api/ai/generate`
- Display markdown-rendered responses in the chat UI
- Add model selection dropdown populated from `GET /api/ai/models`

### Streaming Support
- Implement Server-Sent Events (SSE) for token-by-token streaming
- Add a new streaming endpoint (e.g., `POST /api/ai/generate/stream`)
- Update the frontend chat to consume streaming responses for real-time display

### Environment Variable Configuration
- Support overriding `AIConfig` fields via environment variables
- Example: `AI_PROVIDER`, `AI_MODEL`, `AI_TEMPERATURE`, `AI_BASE_URL`
- Fall back to hardcoded defaults if env vars are not set

### Automated Tests
- Write unit tests for `ContextBuilder`, `PromptBuilder`, `AIProviderFactory`
- Write integration tests using the Mock provider
- Add test coverage for error paths (connection refused, timeout, invalid provider)

## Medium-Term (Next 3–5 Milestones)

### Conversation Memory
- Add session-based conversation history storage (Redis or in-memory)
- Maintain a rolling window of recent messages per session
- Include conversation history in the prompt for context

### Cloud Provider Implementation
- Implement the OpenAI provider with a real API key and `openai` Python SDK
- Implement the Gemini provider with Google's generative AI SDK
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
