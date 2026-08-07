# AI Architecture

## Overview

The AI Copilot follows a layered architecture with clear separation of concerns: a React Copilot panel in the client consumes the API, a FastAPI router receives HTTP requests, an orchestration service coordinates context assembly and prompt construction, a provider factory resolves the correct LLM backend, and concrete provider implementations communicate with external model servers.

## Design Philosophy

The AI module is isolated from TradeRetro's deterministic engine by a strict API boundary. All data that reaches the LLM must pass through explicitly defined request fields — there are no database queries, no internal service calls, and no shared state between the AI module and trading logic. This isn't accidental; it is the core architectural constraint.

**Why API isolation matters.** If the LLM could query the database or call internal services, a prompt injection or model hallucination could trigger unintended operations. By forcing all context data to be explicitly provided by the caller, the system ensures that the LLM can only ever explain what it is given. It cannot discover, modify, or act upon data it was not handed.

**Why two builders?** Context assembly (`ContextBuilder`) and prompt construction (`PromptBuilder`) are separate classes because they solve different problems. The context builder transforms raw domain data into a structured dict — a data-transformation problem. The prompt builder renders that dict into a string — a text-generation problem. Separating them means each can be tested, evolved, and replaced independently. A future version could swap the prompt builder for a chat-template-based approach without touching how context is assembled, or vice versa.

The same principle applies to the provider abstraction. The service layer never imports a concrete provider class. It talks only to `BaseLLMProvider` through the factory. This keeps the orchestration layer decoupled from the specific LLM backend — swapping from LM Studio to Ollama requires no changes to `AIService` or the router.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                           │
│                                                                     │
│  React Copilot Panel (client/src/components/copilot/)               │
│  - useAIStore + aiService.js + aiContextBuilder.js                  │
│  - Injects live backtest state as request context                   │
│          │                                                          │
│          ▼                                                          │
│  FastAPI Router (ai/router.py)                                      │
│  Prefix: /api/ai                                                    │
│  Endpoints: GET /health, GET /models, POST /generate                │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATION LAYER                             │
│                                                                     │
│  AIService (ai/service.py)                                          │
│  - Receives user query + optional domain data                       │
│  - Calls ContextBuilder to assemble structured context              │
│  - Calls PromptBuilder to build the full prompt string              │
│  - Calls AIProviderFactory to resolve and instantiate a provider    │
│  - Calls provider.generate_response(prompt)                         │
│  - Parses JSON response and returns result                          │
└──────┬──────────────────────┬───────────────────────┬───────────────┘
       │                      │                       │
       ▼                      ▼                       ▼
┌──────────────┐    ┌────────────────┐    ┌──────────────────────┐
│ CONTEXT      │    │ PROMPT         │    │ PROVIDER FACTORY     │
│ BUILDER      │    │ BUILDER        │    │                      │
│ (ai/context  │    │ (ai/prompt     │    │ (ai/provider_factory │
│  _builder.py)│    │  _builder.py)  │    │  .py)                │
│              │    │                │    │                      │
│ 6 domains:   │    │ 7 sections:    │    │ Registry lookup      │
│ • user       │    │ 1 System       │    │ → provider type      │
│ • market     │    │   Identity     │    │ → instantiate class  │
│ • strategy   │    │ 2 Core Rules   │    │                      │
│ • backtest   │    │ 3 Quant Rules  │    │                      │
│ • metrics    │    │ 4 Reasoning    │    │                      │
│ • portfolio  │    │ 5 Formatting   │    │                      │
│              │    │ 6 Context Data │    │                      │
│              │    │ 7 User Question│    │                      │
└──────────────┘    └────────────────┘    └──────────┬───────────┘
                                                     │
                                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       PROVIDER LAYER                                │
│                                                                     │
│  BaseLLMProvider (abstract)                                         │
│       │                                                            │
│       ├── MockLLMProvider        — deterministic, offline testing   │
│       ├── OllamaProvider         — local Ollama API (port 11434)    │
│       ├── OpenAICompatibleProvider — LM Studio / vLLM (port 1234)  │
│       ├── OpenAIProvider         — stub (not implemented)           │
│       └── GeminiProvider         — Google Gemini Flash (cloud API)  │
└─────────────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### 1. Router — `ai/router.py`

Thin HTTP transport layer. Defines the `/api/ai` prefix, validates incoming bodies with Pydantic, delegates to `AIService`, and returns structured responses. No business logic.

### 2. Orchestration — `ai/service.py`

`AIService` is the central coordinator. It wires together context assembly, prompt construction, and LLM provider calls. The `generate_response()` method runs the full pipeline inside a `try/except`: if anything fails, it returns `{"success": false, "error": ...}` with a logged traceback. Provider output is parsed with `json.loads()` and falls back to `{"raw_response": ...}` when parsing fails.

All dependencies are injected via the constructor and default to fresh instances if omitted.

### 3. Context Assembly — `ai/context_builder.py`

`ContextBuilder` aggregates up to six data domains, each wrapped in a consistent `{"available": bool, "source": str, "data": dict}` envelope. Metadata is appended with generation timestamp, domain counts, and a list of populated domains. The older `build()` method is preserved for callers that haven't migrated to `build_context()`.

### 4. Prompt Construction — `ai/prompt_builder.py`

`PromptBuilder` assembles seven sections delimited by `=` rulers: system identity (persona + specialization), core behaviour rules (integrity constraints), quantitative analysis rules (metric interpretation principles plus the `METRIC_INTERPRETATION_GUIDES`, `CROSS_METRIC_REASONING_GUIDES`, and `STRATEGY_REASONING_GUIDES` registries), reasoning framework, formatting rules (markdown/citations/no speculation), context data (rendered domain blocks), and the user's question. Each section is built by a dedicated private helper and wrapped by a shared `_section(title, body)` method. Safety rules prohibit fabrication, hallucination, price prediction, and trade recommendations. The older `build()` method injects the user query into context for callers that haven't migrated to `build_prompt()`.

### 5. Provider Factory — `ai/provider_factory.py`

`AIProviderFactory.get_provider(model_or_provider)` resolves a model ID or provider name to a concrete `BaseLLMProvider`. Resolution: try the registry first → use the registered provider type → fall back to treating the input as a provider name. The `openai-compatible` type receives connection details from `AIConfig`; all other providers are instantiated with defaults. Raises `ValueError` for unknown types.

### 6. Provider Layer — `ai/providers/`

Every provider extends `BaseLLMProvider` and implements `generate_response(prompt) -> str`. All return JSON strings with `provider` and `success`; success responses carry `response` (plus `model` and `tokens_used` where the provider tracks them), and failures carry `error`. Common error paths covered: `ConnectError` (server down), `TimeoutException`, 404 (model not loaded), and empty responses.

## Request Lifecycle

```
User Request (POST /api/ai/generate)
        │
        ▼
  1. Router validates GenerateRequest Pydantic model
        │
        ▼
  2. AIService.generate_response() called with:
     user_query + optional provider_name + domain data (market, strategy, etc.)
        │
        ├── 2a. ContextBuilder.build() → unified context dict (6 domains + metadata)
        │
        ├── 2b. PromptBuilder.build() → complete prompt string
        │       (SYSTEM IDENTITY + CORE BEHAVIOUR RULES + QUANTITATIVE ANALYSIS
        │        RULES + REASONING FRAMEWORK + FORMATTING RULES + CONTEXT DATA
        │        + USER QUESTION)
        │
        └── 2c. AIProviderFactory.get_provider(provider_name)
                │
                ├── Registry lookup → provider type
                └── Instantiate provider class
                        │
                        ▼
  3. provider.generate_response(prompt)
        │
        ▼
  4. JSON string returned → AIService attempts json.loads()
        │
        ▼
  5. GenerateResponse returned to client
```

## Provider Abstraction

All providers implement the same interface:

```
BaseLLMProvider (ABC)
┌─────────────────────────────┐
│ + generate_response(prompt) │
│   → str (JSON)              │
└─────────────────────────────┘
```

The provider factory uses a strategy pattern combined with a registry:

1. **Model ID** → lookup in `REGISTERED_MODELS` → get `provider` type → instantiate
2. **Provider name** → direct lookup in `_provider_classes` → instantiate
3. **Not found** → `ValueError`

## Dependency Relationships

```
ai/router.py
  └── ai/service.py
        ├── ai/context_builder.py
        ├── ai/prompt_builder.py
        ├── ai/provider_factory.py
        │     ├── ai/config.py (AIConfig)
        │     ├── ai/registry.py (resolve_model)
        │     └── ai/providers/* (concrete providers)
        └── ai/config.py (AIConfig)

ai/llm_provider.py (legacy)
  └── ai/provider_factory.py (AIProviderFactory)
```

## Design Rationale

| Decision | Reasoning |
|---|---|
| **Provider Factory + Registry** | Adding a new provider requires no changes to orchestration or routing code. The registry decouples "which model" from "which provider class." |
| **Context domains as envelopes** | Every domain carries an `available` flag and `source`. The prompt builder can check availability without knowing the data shape — no conditional branching in the orchestration layer. |
| **JSON responses from providers** | Self-describing responses (`success`, `error`, `tokens_used`) mean the service layer can parse and forward without guessing whether the call succeeded. |
| **Separate builders** | Context assembly and prompt construction are independent concerns. Splitting them makes each testable in isolation and allows swapping prompt strategies without touching data collection. |
| **Low temperature (0.2)** | Trading analysis needs precision, not creativity. A lower temperature reduces hallucinations and produces more deterministic outputs. Note: this is the configured default — it is not yet delivered to provider payloads (see [AI_CONFIGURATION.md](AI_CONFIGURATION.md)). |
| **No streaming** | Blocking requests keep the initial implementation simple. Streaming wouldn't benefit a single-user local setup enough to justify the complexity. |
| **Backward compatibility wrappers** | `build()` and `LLMProviderFactory` exist so code written against the earlier API keeps working. New code should prefer `build_context()`, `build_prompt()`, and `AIProviderFactory`. |
