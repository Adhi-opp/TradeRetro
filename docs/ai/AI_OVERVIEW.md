# AI Overview

## What It Is

The **AI Copilot** is TradeRetro's advisory assistant: a chat panel that explains strategies, backtest results, risk metrics and market context in natural language. It is a **read-only sidecar** layered on top of the deterministic platform — it can never execute trades, change parameters, or modify any trading logic.

## Where It Lives

| Side | Location | Role |
|---|---|---|
| Frontend | `client/src/components/copilot/` + `client/src/store/useAIStore.js` | Chat panel, model picker, context assembly, provider reachability probing |
| Backend | `python-engine/ai/` | Router (`/api/ai/*`), orchestration service, context builder, prompt builder, model registry, provider implementations |

## How It Works (one paragraph)

The client builds a situational context from the **current application state** (symbols, strategy configuration, backtest results, risk metrics, trade log), POSTs it with the user's question to `/api/ai/generate`, and the backend orchestrates three stages: **ContextBuilder** assembles the domain data (6 domains), **PromptBuilder** renders a hand-crafted 7-section system prompt plus optional domain report templates, and **AIProviderFactory** resolves the requested model from the **13-entry model registry** (5 provider backends) and generates the response. Nothing else happens — no database access inside the AI module, no internal service calls, no state kept between requests.

## Capabilities at a Glance

- Context-aware answers without any extra typing (the panel attaches the live backtest state for you).
- Provider-agnostic: Mock (offline, deterministic), LM Studio / OpenAI-compatible (default), Ollama, Gemini (cloud).
- Block-syntax markdown rendering: headings, lists, tables, code blocks.
- Explicit availability handling: unreachable providers surface as a clear banner, never a silent failure.
- Deterministic in tests: the Mock Provider makes the whole pipeline testable offline.

## Read-Only Guarantees (why it is safe)

1. No order routing, signal generation or position management access.
2. No strategy parameters or backtest configuration access.
3. Stateless per request: the server keeps no conversation memory.
4. API-isolated: context travels in explicit request fields; the AI module never touches the database.

## Request Flow

```
[question + live app state]
      │
      ▼
useAIStore.buildContext() ──► POST /api/ai/generate
      │
      ▼
AIService ── ContextBuilder (6 domains) ── PromptBuilder (7 sections)
      │
      ▼
AIProviderFactory ──► mock │ openai-compatible │ ollama │ gemini │ openai
      │
      ▼
[markdown response ──► chat panel]
```

## Documentation Map

Start here, then follow the flow: [Architecture](AI_ARCHITECTURE.md) · [Backend](AI_BACKEND.md) · [API Reference](AI_API_REFERENCE.md) · [Configuration](AI_CONFIGURATION.md) · [Provider System](AI_PROVIDER_SYSTEM.md) · [Model Registry](AI_MODEL_REGISTRY.md) · [Prompt Engineering](AI_PROMPT_ENGINEERING.md) · [Context Builder](AI_CONTEXT_BUILDER.md) · [Quickstart](AI_QUICKSTART.md) · [Monitoring](AI_MONITORING.md) · [Troubleshooting](AI_TROUBLESHOOTING.md) · [Testing](AI_TESTING.md) · [Limitations](AI_LIMITATIONS.md) · [Changelog](AI_CHANGELOG.md) · [Roadmap](AI_FUTURE_ROADMAP.md).