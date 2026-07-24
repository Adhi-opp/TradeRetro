# AI Limitations

The following limitations apply to the current implementation. These are known constraints, not gaps — each reflects a deliberate scope decision for the initial release.

## Functional Limitations

| Limitation | Description |
|---|---|
| **No Streaming** | LLM responses are generated synchronously. The full response must be received before any output is returned to the client. Streaming (SSE/token-by-token) is not supported. |
| **No Authentication** | The `/api/ai/*` endpoints have no authentication or authorization. Any client that can reach the server can call the AI endpoints. |
| **Single User** | No multi-user support. There is no session isolation, rate limiting per user, or user-specific configuration. |
| **No Conversation Memory** | Each `/api/ai/generate` request is stateless. The model has no access to previous queries or responses within a session. Context must be provided with every request. |
| **No RAG (Retrieval-Augmented Generation)** | The system cannot retrieve documents or knowledge base entries to augment prompts. All context must be explicitly provided in the request body. |
| **No Vector Database** | No embeddings, vector storage, or semantic search. All context is structured data passed directly in API calls. |
| **No Agents** | There are no autonomous agents, multi-step reasoning loops, or tool-use capabilities. The system is a single-turn Q&A interface. |
| **No Tool Calling / Function Calling** | The LLM cannot call external functions, query databases, or trigger backend operations. It can only respond based on the prompt it receives. |

## Provider Limitations

| Limitation | Description |
|---|---|
| **Local Inference Only** | The only working providers (mock, openai-compatible, ollama) run locally. Cloud providers (OpenAI, Gemini) are stubs only. |
| **Single Provider Per Instance** | The factory can instantiate any provider, but there is no load balancing or failover between providers. |
| **No Provider Health Checks** | The `/api/ai/health` endpoint does not verify whether the configured provider is reachable. A provider connection error is only surfaced when a `POST /api/ai/generate` request is made. |
| **No Retry Logic** | If a provider call fails (timeout, connection error), the error is returned to the client immediately. No automatic retry is attempted. |

## Model Limitations

| Limitation | Description |
|---|---|
| **Fixed Model Registry** | Static models are hardcoded in `REGISTERED_MODELS`. Adding a new model requires a code change. Only Ollama models are auto-discovered. |
| **Default Model: 1.5B Parameters** | The default model (Qwen2.5-Coder-1.5B-Instruct) is a small model. Its reasoning capability, factual accuracy, and instruction following are limited compared to larger models. |
| **No Model Fallback** | If the requested model/provider fails, there is no automatic fallback to an alternative provider. |

## Configuration Limitations

| Limitation | Description |
|---|---|
| **No Environment Variable Overrides** | AI configuration is hardcoded in `AIConfig` dataclass. There are no environment variable overrides. Changing settings (e.g., LM Studio port, temperature) requires editing `config.py`. |
| **No Runtime Configuration API** | There is no API endpoint to read or update configuration at runtime. `AIConfigurationManager` exists but is not exposed via HTTP. |
| **No Per-Request Provider Configuration** | The `provider_name` field selects the model/provider, but per-request parameters (temperature, max_tokens, etc.) cannot be overridden from the API. |

## Prompt & Context Limitations

| Limitation | Description |
|---|---|
| **Prompt Templates Are Placeholders** | The `.md` files in `ai/prompts/` contain only header comments. They are not loaded or used by the current codebase. The only active prompt is the hardcoded system prompt in `PromptBuilder`. |
| **Context Is Fully Static** | Context data is passed snapshot-style. There is no live data fetching or automatic context enrichment from the backend database or market data services. |
| **No Output Validation** | The LLM response is not validated against any schema or expected format. If the model produces an unexpected response, it is returned as-is. |
| **JSON Parsing Fallback** | If the provider returns non-JSON output, it is wrapped in `{"raw_response": "..."}`. No structured error or retry is attempted. |

## Frontend Limitations

| Limitation | Description |
|---|---|
| **No Frontend Integration** | The `/api/ai/*` endpoints are mounted and functional, but the React client does not reference or consume any AI endpoint. There is no chat UI, no settings panel, and no AI feature surfaced to users. |

## Security Limitations

| Limitation | Description |
|---|---|
| **No Input Sanitization** | User queries are passed directly into prompts without sanitization. Prompt injection is possible. |
| **No Rate Limiting** | There is no rate limiting on `/api/ai/generate`. A malicious client could exhaust local LLM resources. |
| **CORS Wide Open** | `allow_origins=["*"]` in the FastAPI app applies to all routes, including AI endpoints. |

## Performance Considerations

| Consideration | Detail |
|---|---|
| **Blocking LLM Calls** | Provider calls use synchronous `httpx.Client`. For local models, generation can take 10–60 seconds during which the server worker thread is blocked. |
| **Default Timeout: 120s** | The `OpenAICompatibleProvider` uses a 120-second timeout. This is generous but necessary for local LLMs on consumer hardware. |
| **No Caching** | Every request generates a new LLM response. Identical queries are not cached. |
