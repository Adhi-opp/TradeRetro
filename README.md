# TradeRetro AI Copilot

The AI Copilot module adds LLM-powered assistance for quantitative trading analysis within TradeRetro. It uses a modular, provider-agnostic architecture to explain trading strategies, backtest results, and quantitative metrics.

## Why AI Copilot?

TradeRetro's core engine handles deterministic trading logic — backtest execution, signal generation, market data ingestion, and portfolio accounting. This engine is precise, rules-based, and auditable. What it cannot do is explain *why* a strategy behaves a certain way, or help a user interpret a Sharpe ratio of 1.8 versus 0.9.

The AI Copilot fills that gap. It takes the same structured data the engine produces (backtest results, metrics, market prices, portfolio states) and uses an LLM to generate natural-language explanations. This separation is intentional:

- **The AI module cannot execute trades.** It has no access to order routing, signal generation, or position management.
- **The AI module cannot modify trading logic.** It cannot change strategy parameters, enable or disable strategies, or alter backtest configurations.
- **The AI module is purely advisory.** It reads data from the same system and explains it. The deterministic engine remains untouched.

This isolation means the AI module can be developed, tested, and even replaced without risk to the core trading pipeline. If the LLM returns a hallucinated response, it may confuse a user, but it will never misplace a trade or corrupt a backtest.

## Goals

- Provide clear, context-aware explanations of trading strategies and configurations
- Interpret backtest results including equity curves, trade logs, and risk metrics
- Explain quantitative performance metrics (Sharpe ratio, drawdown, win rate, etc.)
- Abstract LLM backends behind a provider-agnostic interface supporting local and cloud models
- Never fabricate data, give financial advice, or execute trades

## Features

- **Provider Abstraction** — Pluggable LLM providers via a factory and registry pattern
- **Context Assembly** — Structured context builder that aggregates market, strategy, backtest, metrics, and portfolio data
- **Context Injection** — The client automatically attaches the current backtest state (strategy, market, backtest, and metrics data) to every Copilot request
- **Prompt Engineering** — 7-section system prompt with persona definition, integrity rules, quantitative reasoning guidance (metric interpretation, cross-metric reasoning, strategy-aware reasoning), and output rules
- **Frontend Copilot Panel** — React chat panel with markdown rendering, in-session conversation history, example prompts, and quick actions
- **Model Registry** — Static + dynamic model registration with Ollama discovery
- **OpenAI-Compatible** — Primary provider targets LM Studio, vLLM, and any OpenAI-compatible endpoint
- **Automated Tests** — 279 tests including a 169-test AI suite covering the router, service, context builder, prompt builder, providers, and provider factory

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  FastAPI    │────▶│  AIService   │────▶│ ContextBuilder│     │  PromptBuilder│
│  Router     │     │  (Orchestr.) │     │               │     │               │
│ /api/ai/*   │     │              │     │ 6 domains     │     │ 7 sections    │
└─────────────┘     └──────┬───────┘     └───────────────┘     └──────┬───────┘
                           │                                          │
                           ▼                                          ▼
                    ┌──────────────┐                          ┌──────────────────┐
                    │ProviderFactory│                         │  Full Prompt     │
                    │  (Registry)   │                         │  (string)        │
                    └──────┬───────┘                         └──────────────────┘
                           │
              ┌────────────┼────────────┬────────────┬────────────┐
              ▼            ▼            ▼            ▼            ▼
         Mock      Ollama    OpenAI-Comp   OpenAI     Gemini
       (testing)  (local)   (LM Studio)   (stub)     (stub)
```

## Directory Structure

```
python-engine/ai/
├── __init__.py                  Package marker
├── config.py                    AIConfig dataclass + AIConfigurationManager
├── service.py                   AIService orchestration layer
├── router.py                    FastAPI router (/api/ai/*)
├── context_builder.py           ContextBuilder — 6-domain context assembly
├── prompt_builder.py            PromptBuilder — system prompt + context + rules
├── provider_factory.py          AIProviderFactory — provider selection + instantiation
├── registry.py                  ModelInfo registry + Ollama discovery
├── ollama_provider.py           Ollama API provider implementation
├── llm_provider.py              Legacy re-export module (deprecated)
├── models/
│   ├── __init__.py              Package marker
│   └── chat.py                  Pydantic request/response models
├── providers/
│   ├── __init__.py              Package exports
│   ├── base_provider.py         BaseLLMProvider abstract base class
│   ├── mock_provider.py         MockLLMProvider (deterministic testing)
│   ├── openai_provider.py       OpenAI provider (stub)
│   ├── openai_compatible_provider.py  OpenAI-compatible provider (primary)
│   └── gemini_provider.py       Gemini provider (Google Gemini Flash)
└── prompts/
    ├── risk.md                  Placeholder — risk assessment prompt template
    ├── metrics.md               Placeholder — metrics explanation prompt template
    └── strategy.md              Placeholder — strategy analysis prompt template
```

Frontend integration lives in `client/src/`:

```
client/src/services/
├── aiService.js                generate() — POST /api/ai/generate
├── aiContextBuilder.js          buildAiContext() — normalizes backtest state into AI context
└── ...
client/src/store/useAIStore.js   Zustand store — messages, loading, panel state, sendMessage()
client/src/components/copilot/   CopilotPanel, MarkdownRenderer, ConversationList, PromptInput, ...
```

## Quick Links

| Document | Description |
|---|---|
| [AI_ARCHITECTURE.md](docs/ai/AI_ARCHITECTURE.md) | Overall architecture, layers, request lifecycle, data flow |
| [AI_BACKEND.md](docs/ai/AI_BACKEND.md) | Source-level walkthrough of every file |
| [AI_API_REFERENCE.md](docs/ai/AI_API_REFERENCE.md) | Endpoint schemas, examples, status codes |
| [AI_CONFIGURATION.md](docs/ai/AI_CONFIGURATION.md) | AIConfig defaults, provider settings, rationale |
| [AI_PROVIDER_SYSTEM.md](docs/ai/AI_PROVIDER_SYSTEM.md) | Factory + registry patterns, all provider implementations |
| [AI_PROMPT_ENGINEERING.md](docs/ai/AI_PROMPT_ENGINEERING.md) | Prompt structure, persona, safety design |
| [AI_CONTEXT_BUILDER.md](docs/ai/AI_CONTEXT_BUILDER.md) | Domain assembly, envelope pattern, metadata |
| [AI_MODEL_REGISTRY.md](docs/ai/AI_MODEL_REGISTRY.md) | Registered models, Ollama discovery, selection flow |
| [AI_TESTING.md](docs/ai/AI_TESTING.md) | Automated test suite layout, manual procedures, provider verification |
| [AI_LIMITATIONS.md](docs/ai/AI_LIMITATIONS.md) | Known constraints and deliberate scope decisions |
| [AI_FUTURE_ROADMAP.md](docs/ai/AI_FUTURE_ROADMAP.md) | Planned work across short/medium/long horizons |
| [AI_CHANGELOG.md](docs/ai/AI_CHANGELOG.md) | Version history |

## Technology Stack

| Component | Technology |
|---|---|
| Framework | FastAPI (Python 3.12) |
| Frontend | React 19 + Zustand (`useAIStore`) + `react-markdown` / `remark-gfm` |
| LLM Backend | LM Studio (primary: Qwen2.5-Coder-1.5B) |
| Provider Protocol | OpenAI-Compatible API (`/v1/chat/completions`) |
| HTTP Client | `httpx` |
| Validation | Pydantic v2 |
| Alternative Providers | Ollama (local), Mock (testing) |
| Stub Providers | OpenAI, Gemini |

## Current Status

**Version:** 1.1.0 — Frontend integration, context injection, and prompt-engineering enhancements (see [AI_CHANGELOG.md](docs/ai/AI_CHANGELOG.md)).

All three endpoints (`health`, `models`, `generate`) are operational over the `/api/ai/*` prefix. The AI Copilot panel is integrated into the React Dashboard: users can chat with the assistant, and the client automatically attaches the current backtest state (strategy, market, backtest, and metrics data) as context. Responses are rendered as rich markdown via `react-markdown`.

The primary working provider is `openai-compatible` targeting LM Studio at `http://localhost:1234`. Two stub providers (OpenAI, Gemini) exist but return not-implemented errors. Prompt templates in `ai/prompts/` are placeholders — the active 7-section system prompt lives in code.

The automated test suite contains **279 tests**, of which **169 cover the AI module** (router, service, context builder, prompt builder, providers, and provider factory).

Stub providers (OpenAI, Gemini) are included for two reasons: to establish the registry schema for cloud models, and to make the intended provider scope visible via `GET /api/ai/models` from day one.
