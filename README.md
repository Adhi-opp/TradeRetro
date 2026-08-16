# TradeRetro

[![CI](https://github.com/Adhi-opp/TradeRetro/actions/workflows/ci.yml/badge.svg)](https://github.com/Adhi-opp/TradeRetro/actions/workflows/ci.yml)

TradeRetro is a quantitative trading research platform for NSE equities: an event-driven backtesting engine combined with a production-grade data pipeline — live ticks via the Upstox V3 WebSocket, EOD history via yfinance, a TimescaleDB medallion warehouse, and a React dashboard for backtesting, cross-asset analysis, data-quality monitoring, and infrastructure observability. An AI Copilot layer adds natural-language explanations of strategies, results, and metrics without ever touching the deterministic trading logic.

Why each piece of the stack was chosen (and what was rejected) is documented as ADRs in [docs/design-decisions.md](docs/design-decisions.md); throughput claims are backed by a reproducible benchmark in [docs/benchmarks/](docs/benchmarks/).

---

## Problem

Backtesting retail trading strategies on Indian equities is a data problem as much as a backtest problem. Retail tools either hide the pipeline (opaque data, no lineage, no quality checks) or require assembling scraping scripts, stores, and schedulers by hand — none of which validate that the numbers being backtested are trustworthy.

TradeRetro addresses the full loop: real NSE market data with lineage and quality gates, an honest event-driven backtest engine, and analytical surfaces that let a user *interpret* results rather than just chart them.

## What TradeRetro Does

The product workflow is **CONFIGURE → TEST → MEASURE → INTERPRET → ANALYZE**:

1. **CONFIGURE** — pick one of five daily-bar strategies, expose its full parameters, and optionally set risk parameters (position sizing + stop-loss) and the Indian transaction-cost model.
2. **TEST** — run a vectorized, event-driven backtest (next-bar-open fills) or dig deeper with a parameter sweep and walk-forward analysis.
3. **MEASURE** — get a complete risk/return profile: Sharpe, Sortino, Calmar, max drawdown + duration, VaR 95%, alpha vs buy-and-hold, monthly heatmap, return distribution, and trade analytics.
4. **INTERPRET** — read the Strategy Assessment report (robust/marginal/overfit verdict, regime-aware narrative) or ask the AI Copilot in plain language, with the current backtest state attached as context.
5. **ANALYZE** — examine cross-asset relationships (correlation matrix, rolling/lead-lag/divergence), monitor live market data and India VIX, and verify the underlying data quality before trusting any result.

## Objectives

TradeRetro exists to close a specific gap in retail quant research on Indian markets — trustworthy data, honest backtest results, and understandable outputs:

1. **Trustworthy data** — every number the user backtests has lineage: a streaming pipeline with quality gates, an auditable medallion warehouse, freshness/coverage surfaces, and explicit source/staleness labels on every quote.
2. **Honest backtesting** — no same-bar look-ahead (next-bar-open fills), deterministic slippage, Indian transaction costs, optional risk model, and an automated walk-forward assessment that flags overfit parameter choices.
3. **Interpretable results** — performance metrics, Strategy Assessment verdicts, and an advisory AI Copilot that explains *what* the numbers mean and *why*, grounded in the actual run state.
4. **Operationally demonstrable** — a production-grade data-engineering showcase (Redis Streams, TimescaleDB medallion, Prefect orchestration, Grafana telemetry, Docker Compose) that runs end-to-end including in simulator mode.
5. **Honest release** — documentation and claims that reflect exactly what the current release contains (see [Project Status](#project-status)).

## Key Features

| Feature | What it is |
|---|---|
| **Strategy Configuration** | 5 daily-bar strategies with full parameter exposure (MA Crossover, RSI, MACD, Bollinger Breakout, Donchian Breakout), optional risk model and cost model |
| **Event-Driven Backtesting** | Vectorized simulation; signals on bar close, fills at **next bar open** (no look-ahead); risk model, Indian transaction costs, deterministic slippage |
| **Walk-Forward Analysis** | Rolling train/test optimization, out-of-sample stitching, efficiency ratio + `robust / marginal / overfit` verdict |
| **Parameter Sweep** | 2-parameter grid over any strategy, returned as a 2D metric grid |
| **Market Data** | Live NSE ticks (Upstox V3 WebSocket, protobuf), India VIX, EOD history (yfinance), Redis-first quote resolution with EOD fallback and explicit `source`/staleness labels |
| **Performance Analytics** | Client-side risk metrics from equity curve + trade log: Sharpe/Sortino/Calmar, drawdowns, VaR, heatmap, distributions, trade stats |
| **Strategy Assessment** | Automated assessment report — verdict, trade behavior, regime analysis, limitations — for result interpretation |
| **Market Overview** | Landing screen and live overview: live quotes for tracked instruments with source labels, VIX gauge with regime band |
| **Cross-Asset Monitor** | Correlation matrix, rolling correlation, lead-lag proxy, divergence detection; macro signal feed; live price charts with `LIVE` tail |
| **Data Quality** | Medallion health (tick rate, layer counts, freshness), per-ticker quality audits (hard/soft checks, gap detection against the empirical NSE calendar), pipeline gate enforcement |
| **Feedback** | In-app feedback modal capturing reviewer comments for the release process |
| **AI Copilot** | Advisory chat panel with markdown rendering, model selection, and automatic backtest-context injection (see [AI Copilot](#ai-copilot)) |
| **Observability** | 4 auto-provisioned Grafana dashboards (pipeline health, market data, data quality, system metrics) embedded in the app |

## Product Workflow

A realistic session: a user opens TradeRetro, lands on the overview (live market snapshot), and opens the Backtest workspace. They configure, say, an MA Crossover on `RELIANCE.NS` with risk parameters and costs enabled, run the backtest, and study the equity curve, drawdown, and risk grid. They then run a walk-forward analysis to check whether the parameter choice is robust out-of-sample, or a sweep to map the parameter space. The Strategy Assessment report and the AI Copilot explain *why* the results look the way they do. Before publishing any conclusion, the user checks the Cross-Asset Monitor and the Data Quality dashboard to confirm the underlying series are fresh and clean.

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│ LIVE TICK PIPELINE (pipeline-worker)                                       │
│                                                                            │
│   Upstox V3 WebSocket ──► upstox_ws producer ── XADD ──► Redis Stream      │
│   (NSE_EQ+NSE_INDEX, protobuf)             HSET ──► market:latest hash     │
│   (or simulator when PIPELINE_MODE=simulate)                               │
│                                   XREADGROUP ──► consumer (batch 200)      │
│                                   ──► bronze.market_ticks (retention 30d)  │
│                                   ──► silver.ohlcv_1min (idempotent UPSERT)│
│                                   ──► gold.ohlcv_5min/daily (continuous    │
│                                        aggregates)                         │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ EOD PIPELINE (api container)                                               │
│   in-process asyncio scheduler (Mon–Fri 16:00 IST, startup catch-up)       │
│   Prefect flows: eod_pipeline, historical_backfill, quality_check          │
│   yfinance ──► raw.historical_prices ──► quality gates ──► daily signals   │
│   → ops.data_catalog watermarks (incremental), ops.ingestion_log audit     │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ SERVING                                                                     │
│                                                                             │
│  React 19 + Vite (5173) ──► FastAPI (8000): /api/backtest, /api/live/*,     │
│      /api/quality, /api/correlation/*, /api/ingest/*, /api/universe,        │
│      /api/reconcile, /api/auth, /api/health, /api/feedback                  │
│  Grafana (3000, kiosk-embedded)   Prefect UI (4200)                         │
│                                                                             │
│  AI SIDECAR — advisory only, no path to the engine:                        │
│   React Copilot panel ──► POST /api/ai/generate ──► AIService               │
│       ──► ContextBuilder (6 domains) + PromptBuilder (7 sections)           │
│       ──► AIProviderFactory ──► LM Studio / OpenAI-compatible (default)     │
│                                    │  Gemini (cloud) │ Ollama │ Mock        │
│                                    │  (OpenAI = stub, not implemented)      │
└────────────────────────────────────────────────────────────────────────────┘
```

The AI Copilot is a **read-only sidecar**: it consumes the same structured data the engine produces and never executes trades, never changes strategy parameters, and cannot modify backtest configuration.

## Backend Architecture

The Python engine lives in `python-engine/` and is organized by responsibility:

| Module | Responsibility |
|---|---|
| `main.py` | FastAPI app factory, CORS, lifespan wiring (shared asyncpg pool, scheduler) |
| `routers/` | Mounted routers: `/api/backtest`, `/api/live/*`, `/api/quality`, `/api/correlation/*`, `/api/ingest/*`, `/api/universe`, `/api/reconcile`, `/api/auth`, `/api/health`, `/api/feedback`, `/api/ai/*` |
| `core/` | DB pool, Redis client, settings, dependencies |
| `engine/` | Strategies, indicators, execution (next-bar-open), costs, metrics, walk-forward, sweeps |
| `pipeline/` | Upstox WebSocket producer/consumer, silver aggregator, reconciler, EOD Prefect flows |
| `ai/` | AI Copilot service: registry, provider factory, context builder, prompt builder, providers |
| `run_api_with_dummy_redis.py` / tests | Standalone (captive) runtime without Postgres/Redis for local UI exploration; pytest suite (335 functions) |

Design choices: vectorized pandas/numpy simulation for the five daily-bar strategies; asyncpg connection pool shared across routers via FastAPI lifespan; SQL migrations (000–010) auto-applied on first boot; a startup catch-up scheduler for the EOD pipeline; and an advisory AI sidecar that can never touch the deterministic trading path.

## Frontend

The client lives in `client/` (React 19 + Vite 7 + Zustand 5), structured as feature trees rather than a flat components pile — see the [Frontend documentation](docs/frontend/architecture.md) for the full map:

- **State** — two Zustand stores: `useBacktestStore` (instruments, strategy/params, risk & cost toggles, result envelope) and `useAIStore` (chat session, model selection, provider reachability). Theme is local React state persisted to `localStorage` (`tr-theme`) and applied via `data-theme` on `<html>`.
- **Views** — Landing screen, then the terminal shell: pinned sidebar, dashboard header (MarketClock, live quotes), simulator workspace (control bar, strategy config, ticker input), results (KPI ribbon, equity curve, deep analytics, trade log, tearsheet grid), Cross-Asset Monitor, Data Quality console, AI Copilot panel, Feedback and About modals, and an embedded Pipeline dashboard.
- **Design system** — amber-accent, dark-first, CSS-variable token system (`--primary: #F59E0B` dark / `#d97706` light) with full `[data-theme="light"]` coverage. Token reference and the documented `colors.js` drift: [docs/frontend/design-system.md](docs/frontend/design-system.md).
- **Charts** — Recharts 3 (equity curve, drawdown, distributions) + TradingView Lightweight Charts 5 (live series).
- **Docs** — quickstart, architecture, state management, data flows, design system, testing, troubleshooting: [docs/frontend/](docs/frontend/).

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Backend | FastAPI + Uvicorn (Python 3.12, asyncpg) | REST API, in-process EOD scheduler, mounted routers |
| Database | TimescaleDB (PostgreSQL 16) | Medallion warehouse: hypertables, continuous aggregates, retention policies |
| Message broker / cache | Redis 7 (Streams + Hash) | `market:ticks` stream, `market:latest` O(1) snapshots, OAuth token persistence |
| Orchestration | Prefect 3 | EOD / backfill / quality-check DAGs with UI |
| Market data | Upstox V3 (WebSocket + REST, protobuf) · yfinance | Live NSE ticks + VIX · EOD OHLCV bulk history |
| Backtest engine | Python — pandas / numpy (vectorized) | Simulation, strategies, indicators, costs, metrics, WFA, correlation |
| Frontend | React 19 + Vite 7 · Zustand · Tailwind CSS 4 | Dashboard UI, state, styling |
| Charting | Recharts 3 · TradingView Lightweight Charts 5 | Equity curves, heatmaps, distributions, live/price charts |
| Observability | Grafana | 4 auto-provisioned dashboards on `ops.*` + `timescaledb_information.*` |
| Infra | Docker Compose (7 services) | Single-host deployment (~1.4 GB RAM reference footprint) |
| Testing | pytest · ruff · GitHub Actions CI | Unit + endpoint tests and linting on push/PR |

## Backtesting Engine

- **Five daily-bar strategies** — MA Crossover, RSI, MACD histogram, Bollinger Breakout, Donchian Breakout. (Intraday-only strategies — Opening Range Breakout, VWAP reversion — were deliberately removed: they produce meaningless signals on daily EOD bars.)
- **Honest execution** — signals are computed on a bar's close but orders fill at the *next bar's open*; a signal on the final bar never fills. No same-bar look-ahead.
- **Optional risk model** — per-trade position sizing + stop-loss (`riskPct`, `stopLossPct`); stops are resting orders that fill intrabar; each trade records an `exitReason` (`signal` / `stop` / `force_close`).
- **Cost model** — Indian equity transaction costs (STT, stamp duty, GST, brokerage, SEBI turnover fee, exchange charges) with deterministic slippage; toggleable per run.
- **Walk-forward analysis** — per-fold in-sample optimization then out-of-sample testing, stitched OOS equity curve, efficiency ratio and a `robust / marginal / overfit` verdict. Catches curve-fitting.
- **Performance metrics** — computed client-side from the equity curve and trade log (no extra round-trip): Sharpe, Sortino, Calmar, max drawdown + duration, VaR 95%, monthly heatmap, return distribution, win rate, profit factor, expectancy, streaks, alpha vs buy-and-hold.

The engine is an evaluator for hypothesis testing, not an execution system — it does not place real orders.

## Market Data & Data Pipeline

- **Live plane:** Upstox V3 WebSocket (protobuf-encoded `MarketDataFeed.proto`), redeemed via Upstox OAuth2 (token persisted in Redis with 1-year TTL). A built-in **simulator** (`PIPELINE_MODE=simulate`, default) bootstraps base prices from the warehouse and oscillates them, so the whole stack runs without credentials or market hours.
- **Historical plane:** yfinance EOD OHLCV, incremental via per-ticker `ops.data_catalog` watermarks; quality gates (hard checks block, soft checks warn); gap detection uses NIFTY 50 as the empirical NSE calendar — no hardcoded holiday list.
- **Medallion warehouse:** `bronze` (append-only ticks, 30-day retention) → `silver` (cleaned 1-min OHLCV, idempotent upserts) → `gold` (5-min / daily continuous aggregates). 11 version-controlled migrations (000–010) applied on first boot.
- **Telemetry:** `ops.pipeline_metrics` hypertable feeds the Grafana dashboards; `/api/health/pipeline` surfaces live tick rate and per-layer freshness.
- **Self-healing:** a reconciler (live mode, every 3 min during market hours) detects missing 1-min silver buckets and patches them from the Upstox intraday-candle REST API (`source='reconciled'` lineage).
- **Fallback & lineage:** `/api/live/quotes` resolves Redis-first (tick age < 60 s) with EOD fallback — every quote carries `source: upstox | eod` and `stale_days`, so the frontend never hides where a number came from.
- Measured throughput: sub-second tick→bronze latency up to ~2,500 ticks/s, zero ticks lost at 10,000/s (see benchmark report).

## Strategy Assessment

An automated post-run assessment of the completed backtest: an overall verdict (e.g. robust / marginal / overfit), trade-behavior statistics, regime behavior (how performance splits across volatility/trend regimes), and explicit limitations of the run. It is descriptive — it explains what the backtest shows and why, and does **not** modify parameters, pick strategies, or guarantee future performance.

## Cross-Asset Analysis

Pure pandas/numpy correlation analytics served over `/api/correlation/*` and rendered in the Cross-Asset Monitor tab:

- **Matrix** — N×N Pearson heatmap over log-returns for 10/20/60-day windows.
- **Rolling** — rolling correlation of a base symbol vs peers, exposing regime breaks.
- **Lead-lag** — lagged-correlation proxy (**not** Granger causality).
- **Divergence** — cumulative-percentage series for heavyweight divergence detection.

Alongside: a live ticker row (Redis-first, auto-polling), the India VIX gauge with a Low/Normal/Elevated/High regime band plus advice, a macro signal feed (divergence, USD/INR spikes, VIX alerts, risk-off combos), and price charts with a `LIVE` tail point.

## Data Quality

- **Medallion Health card** — live tick rate, bronze/silver/gold/raw counts, freshness per layer (auto-refresh).
- **Quality Gate card** — per-ticker hard fails / soft warnings / gaps / staleness with severity badges (data from `/api/quality/audit`).
- **Coverage stats** — backfill completion, total rows, freshness; ticker inventory with date ranges and quality bars.
- Quality is also enforced *in the pipeline* (hard checks block ingestion) and surfaced in Grafana — and the app fails loudly into an explicit no-data state when audit data is unavailable.

## Feedback

An in-app feedback modal (triggered from the sidebar) lets reviewers capture comments during the release process without leaving the product: category + free-text, submitted to `POST /api/feedback` and persisted server-side. It is a lightweight release-process channel, not a customer-support system.

## AI Copilot

The Copilot is an **advisory sidecar** layered on the deterministic system:

- It **cannot execute trades** (no order routing, signal generation, or position management access).
- It **cannot modify trading logic** — no strategy parameters, no backtest configuration.
- It is **stateless per request**: the client attaches current backtest context to every call; the server keeps no conversation memory.

Request flow: the React panel posts to `POST /api/ai/generate` → `AIService` assembles context via the **ContextBuilder** (6 domains: strategy, market, backtest, metrics, portfolio metadata, user) and a **PromptBuilder** (7-section system prompt with persona, integrity rules, quantitative reasoning guidance, output rules; report-mode sections for structured analysis) → the **AIProviderFactory** selects a provider by name:

| Provider | Type | Notes |
|---|---|---|
| `openai-compatible` | **Primary (default)** | Any OpenAI-compatible endpoint — LM Studio by default (`http://localhost:1234`), also vLLM etc. |
| `gemini` | Cloud | Google Gemini Flash (`gemini-3.6-flash`) via `generateContent` REST; requires `GEMINI_API_KEY` |
| `ollama` | Local | Ollama models via registry |
| `mock` | Testing | Deterministic responses for tests |
| `openai` | Stub | Registry entry only; **not implemented** — returns not-implemented |

The **model registry** (13 static entries) exposes selectable models via `GET /api/ai/models`; the Copilot header dropdown and settings modal let the user pick provider/model per session. Default model: `qwen2.5-coder-1.5b-instruct` on LM Studio. The context builder only attaches domains that actually have data (`buildAiContext` never sends empty objects).

**Limitations (deliberate, current-release scope):** no streaming; no server-side conversation memory; no authentication on `/api/ai/*`; single user; no RAG / vector database / agents / tool calling; no provider failover or retry logic; cloud use depends on the model endpoint being reachable. Full detail: [docs/ai/AI_LIMITATIONS.md](docs/ai/AI_LIMITATIONS.md).

Full AI module documentation (16 files): [AI_OVERVIEW](docs/ai/AI_OVERVIEW.md) · [AI_QUICKSTART](docs/ai/AI_QUICKSTART.md) · [AI_ARCHITECTURE](docs/ai/AI_ARCHITECTURE.md) · [AI_BACKEND](docs/ai/AI_BACKEND.md) · [AI_API_REFERENCE](docs/ai/AI_API_REFERENCE.md) · [AI_CONFIGURATION](docs/ai/AI_CONFIGURATION.md) · [AI_PROVIDER_SYSTEM](docs/ai/AI_PROVIDER_SYSTEM.md) · [AI_MODEL_REGISTRY](docs/ai/AI_MODEL_REGISTRY.md) · [AI_PROMPT_ENGINEERING](docs/ai/AI_PROMPT_ENGINEERING.md) · [AI_CONTEXT_BUILDER](docs/ai/AI_CONTEXT_BUILDER.md) · [AI_MONITORING](docs/ai/AI_MONITORING.md) · [AI_TROUBLESHOOTING](docs/ai/AI_TROUBLESHOOTING.md) · [AI_TESTING](docs/ai/AI_TESTING.md) · [AI_LIMITATIONS](docs/ai/AI_LIMITATIONS.md) · [AI_CHANGELOG](docs/ai/AI_CHANGELOG.md) · [AI_FUTURE_ROADMAP](docs/ai/AI_FUTURE_ROADMAP.md).

## Project Evolution

TradeRetro started as a **Study Project** and evolved into the **Capstone** product in this repository — the About screen states it directly: *"TradeRetro began as a Study Project and continues into the Capstone with greater depth."*

The current implementation is the **final, evolved architecture**, not the earlier iteration: the Phase-0 refactor consolidated the backend onto **FastAPI + TimescaleDB** and **purged the legacy JavaScript/MERN stack** (commit history: `refactor(phase0): consolidate backend into FastAPI + TimescaleDB, purge legacy MERN stack`). Everything in this README describes the current implementation — the Python engine, Redis Streams pipeline, medallion warehouse, React 19 frontend, and the AI Copilot layer. Remaining historical work products (task reports, sprint reports, audit documents) live outside the tracked tree.

## Getting Started

### Prerequisites

- Docker Desktop (Compose v2)
- 16 GB RAM recommended
- Upstox API credentials *(optional — simulator mode works without them)*

### 1. Configure

```bash
git clone https://github.com/Adhi-opp/TradeRetro.git
cd TradeRetro
cp .env.example .env
# Edit .env: UPSTOX_CLIENT_ID / UPSTOX_CLIENT_SECRET if you have them
# GEMINI_API_KEY is only needed for the Gemini Copilot provider
```

### 2. Start

```bash
docker compose up -d
```

### 3. Verify

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/health/pipeline   # bronze/silver/gold counts
```

### 4. Open the UIs

| UI | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API docs (Swagger) | http://localhost:8000/docs |
| Prefect UI | http://localhost:4200 |
| Grafana | http://localhost:3000 (admin / traderetro) |

### 5. (Optional) Go live

```bash
# Log in to Upstox and approve:  http://localhost:8000/api/auth/login
# Edit .env: PIPELINE_MODE=live, then
docker compose up -d pipeline-worker
```

The worker auto-connects at the next NSE open (09:00 IST, Mon–Fri). Default is `PIPELINE_MODE=simulate` — the simulator bootstraps from the EOD warehouse, so every feature works offline.

### Local development (no Docker for the frontend)

```bash
cd client && npm install && npm run dev      # Vite dev server (needs backend)
cd python-engine && pip install -r requirements.txt
python main.py                               # or via docker compose up -d api
```

## Docker Setup

Seven compose services with health checks and ordered startup (`depends_on: condition: service_healthy`):

| # | Service | Image | Port | Purpose |
|---|---|---|---|---|
| 1 | `timescaledb` | `timescale/timescaledb:latest-pg16` | 5432 | Warehouse |
| 2 | `redis` | `redis:7-alpine` | 6379 | Tick stream, latest-quote hash, token store |
| 3 | `api` | `python-engine` (FastAPI) | 8000 | REST API + in-process EOD scheduler |
| 4 | `pipeline-worker` | `python-engine` (worker) | — | Producer + consumer + silver aggregator (+ reconciler in live mode) |
| 5 | `prefect-server` | `prefecthq/prefect:3-latest` | 4200 | Orchestration UI + flow monitoring |
| 6 | `grafana` | `grafana/grafana:latest` | 3000 | Provisioned dashboards, anonymous read + iframe embed |
| 7 | `client` | React/Vite | 5173 | Frontend |

Common operations:

```bash
docker compose ps                          # status
docker compose logs -f api                 # tail API logs
docker compose up -d --build client        # rebuild after React change
docker compose up -d --build api           # rebuild after Python change
docker compose down                        # stop everything
```

## Environment Variables

Full template in [`.env.example`](.env.example). Key configuration:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | TimescaleDB connection (Compose overrides with internal hostname) |
| `REDIS_URL` | Redis connection |
| `UPSTOX_CLIENT_ID` / `UPSTOX_CLIENT_SECRET` / `UPSTOX_REDIRECT_URI` / `UPSTOX_ACCESS_TOKEN` | Upstox V3 credentials (optional; simulator needs none) |
| `GEMINI_API_KEY` / `GEMINI_MODEL` / `GEMINI_BASE_URL` | Cloud Copilot provider (optional) |
| `PREFECT_API_URL` | Prefect server (Docker-only; local dev can omit) |
| `PIPELINE_MODE` / `SIMULATE_RATE` | `simulate` (default) \| `live` \| `consumer_only`; ticks/sec in simulate mode |
| `HOST` / `PORT` | API bind address |
| `DISABLE_EOD_SCHEDULER` | Disable the in-process scheduler (tests / multi-replica) |

Never commit real credentials to `.env` — it is gitignored and excluded from the repository.

## Testing

The backend has **335 pytest test functions across 15 files — 225 covering the AI module** (router, service, config, context builder, prompt builder, providers, factory). With parameterization the suite collects 339 cases (229 AI), as documented in [docs/ai/AI_TESTING.md](docs/ai/AI_TESTING.md).

```bash
cd python-engine
pip install -r requirements.txt
python -m pytest tests/ -v     # full suite (~15 files)
python -m pytest tests/test_ai_router.py tests/test_ai_service.py -v   # AI subset
```

Tests stub Redis / asyncpg / Prefect via `sys.modules`, so they run without Docker or credentials. Coverage highlights: backtest simulation and determinism, Indian cost model, risk metrics, walk-forward verdicts, correlation analytics, pipeline quality checks, reconciliation gap logic, routers, and the AI suite.

CI (.github/workflows/ci.yml) runs `ruff check .` and `python -m pytest tests/ -v` on every push to `main` / `v2-python-engine` and every PR to `main`.

## Known Limitations

- **Local LLM inference** must be running for the `openai-compatible` (LM Studio) and `ollama` Copilot providers; the Gemini cloud provider requires a valid, reachable `GEMINI_API_KEY` (external credentials can expire or be unavailable).
- **Market data**: live mode requires valid Upstox credentials and market hours; without them the simulator produces synthetic ticks (clearly bounded oscillation) — real-time numbers are replaced by simulated ones. EOD freshness depends on the daily yfinance run; quotes fall back to EOD closes labelled with `stale_days`.
- **AI Copilot** is synchronous/stateless with no auth, memory, RAG, agents, tool calling, or failover — see [docs/ai/AI_LIMITATIONS.md](docs/ai/AI_LIMITATIONS.md).
- **Backtesting** is an offline evaluator on **daily** bars for five strategies; it does not support intraday strategies or live paper trading, and it is not financial advice.
- **Telemetry** (Grafana/Prefect) depends on the containerized observability stack being up; the app itself degrades gracefully when they are not.

## Future Roadmap

The roadmap deliberately distinguishes status:

- **CURRENT** — everything implemented in this release (data pipeline, backtesting engine, cross-asset analytics, data quality, AI Copilot with Gemini support, feedback); complete AI itemized list in [docs/ai/AI_CHANGELOG.md](docs/ai/AI_CHANGELOG.md).
- **PLANNED** (from [docs/ai/AI_FUTURE_ROADMAP.md](docs/ai/AI_FUTURE_ROADMAP.md)) — SSE streaming for Copilot responses; conversation memory; full OpenAI provider; quick-action wiring; prompt-template loading from `ai/prompts/`; per-provider configuration profiles.
- **DEFERRED** — RAG / vector retrieval (pgvector, Qdrant or Chroma), tool/function calling, authentication + rate limiting on AI endpoints, configuration API, response-output schema validation.

Deferred features are explicitly **not** implemented in this release and are not claimed as capabilities.

## Project Timeline

| Phase | What happened |
|---|---|
| Study Project | Original prototype iteration (legacy JS/MERN stack era) |
| Phase-0 refactor | Backend consolidated onto **FastAPI + TimescaleDB**; legacy MERN stack purged (`refactor(phase0)` commit) |
| v0.9.0 — Capstone Release Candidate | Current state: Python engine, Redis Streams pipeline, medallion warehouse, React 19 frontend, AI Copilot layer, documentation release (16 AI docs, frontend docs, screenshot set, PDF reports) |
| v1.0.0 (reserved) | Final release — pending completion of the release process (verification, feedback close-out) |

## Project Status

**v0.9.0 — Capstone Release Candidate** (canonical product identity in `client/src/constants/product.js`; v1.0.0 is reserved until the release process completes).

- **Done (release week)** — 38 verified screenshots (19 screens × dark/light); 7 frontend docs; 4 new AI docs (overview, quickstart, monitoring, troubleshooting — 16 total); PDF documentation set (Project Documentation — 29 pp., 12 figures; AI Copilot Report — 13 pp., 8 figures; Frontend Report — 28 pp., 24 figures); theme QA report; honest README with design-truth corrections (amber accent, `colors.js` divergence, standalone-mode caveats).
- **Remaining for v1.0.0** — final grader/reviewer pass over deliverables; close out feedback items; resolve the `colors.js` token drift; optional: Docker-based smoke run of the full stack.
- **Blockers** — none at repository level; local preview currently runs the backend in standalone mode (no Postgres/Redis), so `/api/signals/unified/*` and live-simulator surfaces return 500/placeholder — this is an environment limitation, documented per surface.

## Documentation Index

| Area | Contents | Location |
|---|---|---|
| **AI module** | 16 docs: overview, quickstart, architecture, backend, API reference, configuration, provider system, model registry, prompt engineering, context builder, monitoring, troubleshooting, testing, limitations, changelog, roadmap | [docs/ai/](docs/ai/) |
| **Frontend** | 7 docs: quickstart, architecture, state management, data flows, design system, testing, troubleshooting | [docs/frontend/](docs/frontend/) |
| **Screenshots** | 38 full-resolution captures (19 screens × 2 themes) + metadata/caveats README | [docs/assets/screenshots/](docs/assets/screenshots/) |
| **PDF reports** | Project Documentation (29 pp., 12 figures) · AI Copilot Report (13 pp., 8 figures) · Frontend Report (28 pp., 24 figures) | [docs/TradeRetro_Documentation.pdf](docs/TradeRetro_Documentation.pdf) · [docs/TradeRetro_AI_Copilot_Report.pdf](docs/TradeRetro_AI_Copilot_Report.pdf) · [docs/TradeRetro_Frontend_Report.pdf](docs/TradeRetro_Frontend_Report.pdf) |
| **Design decisions & benchmarks** | ADRs, throughput benchmark methodology/results | [docs/design-decisions.md](docs/design-decisions.md) · [docs/benchmarks/](docs/benchmarks/) |
| **Theme QA (dev)** | Token audit, capture verification, console-error log, caveats | `.opencode/reports/documentation-release/theme-qa.md` |

## Academic / Capstone Context

TradeRetro is a capstone project demonstrating end-to-end data-engineering and quantitative-systems engineering: a real streaming ETL pipeline (Upstox → Redis Streams → TimescaleDB medallion), self-healing data operations, an event-driven backtest engine with an honest execution model, and an advisory LLM layer — documented with ADRs ([docs/design-decisions.md](docs/design-decisions.md)) and reproducible benchmarks ([docs/benchmarks/](docs/benchmarks/)).

## License

The repository does not currently ship a license file; licensing terms are pending project closure. (The earlier `README_TR.md` draft stated MIT — this README only claims what the repository actually contains.)