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
- **Prompt Engineering** — System prompt with persona definition, output rules, and safety constraints
- **Model Registry** — Static + dynamic model registration with Ollama discovery
- **OpenAI-Compatible** — Primary provider targets LM Studio, vLLM, and any OpenAI-compatible endpoint
- **Three API Endpoints** — Health check, model listing, and text generation
- **Error Resilience** — Graceful handling of connection errors, timeouts, and missing models

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  FastAPI    │────▶│  AIService   │────▶│ ContextBuilder│     │  PromptBuilder│
│  Router     │     │  (Orchestr.) │     │               │     │               │
│ /api/ai/*   │     │              │     │ 6 domains     │     │ System+Context│
└─────────────┘     └──────┬───────┘     └───────────────┘     │ +Output+User  │
                           │                                    └──────┬───────┘
                           │                                           │
                           ▼                                           ▼
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
│   └── gemini_provider.py       Gemini provider (stub)
└── prompts/
    ├── risk.md                  Placeholder — risk assessment prompt template
    ├── metrics.md               Placeholder — metrics explanation prompt template
    └── strategy.md              Placeholder — strategy analysis prompt template
```

## Quick Links

| Document | Description |
|---|---|
| [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md) | Overall architecture, layers, request lifecycle, data flow |
| [AI_BACKEND.md](AI_BACKEND.md) | Source-level walkthrough of every file |
| [AI_API_REFERENCE.md](AI_API_REFERENCE.md) | Endpoint schemas, examples, status codes |
| [AI_CONFIGURATION.md](AI_CONFIGURATION.md) | AIConfig defaults, provider settings, rationale |
| [AI_PROVIDER_SYSTEM.md](AI_PROVIDER_SYSTEM.md) | Factory + registry patterns, all provider implementations |
| [AI_PROMPT_ENGINEERING.md](AI_PROMPT_ENGINEERING.md) | Prompt structure, persona, safety design |
| [AI_CONTEXT_BUILDER.md](AI_CONTEXT_BUILDER.md) | Domain assembly, envelope pattern, metadata |
| [AI_MODEL_REGISTRY.md](AI_MODEL_REGISTRY.md) | Registered models, Ollama discovery, selection flow |
| [AI_TESTING.md](AI_TESTING.md) | Manual test procedures, provider verification, unit test templates |
| [AI_LIMITATIONS.md](AI_LIMITATIONS.md) | Known constraints and deliberate scope decisions |
| [AI_FUTURE_ROADMAP.md](AI_FUTURE_ROADMAP.md) | Planned work across short/medium/long horizons |
| [AI_CHANGELOG.md](AI_CHANGELOG.md) | Version history |

## Technology Stack

| Component | Technology |
|---|---|
| Framework | FastAPI (Python 3.12) |
| LLM Backend | LM Studio (primary: Qwen2.5-Coder-1.5B) |
| Provider Protocol | OpenAI-Compatible API (`/v1/chat/completions`) |
| HTTP Client | `httpx` |
| Validation | Pydantic v2 |
| Alternative Providers | Ollama (local), Mock (testing) |
| Stub Providers | OpenAI, Gemini |

## Current Status

**Version:** 1.0.0 — Initial implementation.

All three endpoints (`health`, `models`, `generate`) are operational over the `/api/ai/*` prefix. The primary working provider is `openai-compatible` targeting LM Studio at `http://localhost:1234`. Two stub providers (OpenAI, Gemini) exist but return not-implemented errors. Prompt templates in `ai/prompts/` are placeholders — the active system prompt lives in code.

**No frontend integration yet.** The React client doesn't reference any AI endpoint. The API is ready for consumption but no chat UI or settings panel exists. This was a deliberate sequencing choice: building the backend contract first, then wiring the UI in a follow-up milestone.

Stub providers (OpenAI, Gemini) are included for two reasons: to establish the registry schema for cloud models, and to make the intended provider scope visible via `GET /api/ai/models` from day one.
