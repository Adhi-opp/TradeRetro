# TradeRetro

A high-throughput financial data pipeline and quantitative backtesting platform for NSE equities. Ingests live market data via the Upstox V3 WebSocket, persists to a TimescaleDB Medallion warehouse with continuous bronze→silver→gold aggregation, orchestrates EOD pipelines through Prefect, and serves a React UI for cross-asset research and strategy backtesting.

Built as a Data Engineering portfolio project demonstrating production-grade streaming ETL, time-series warehousing, data-quality enforcement, and observability on real Indian equity market data.

---

## Architecture

```
   ┌─────────────────────────────────────────────────────────────────────────┐
   │  LIVE TICK PIPELINE                                                     │
   │                                                                         │
   │   Upstox V3 WebSocket                                                   │
   │   (NSE_EQ + NSE_INDEX, protobuf-encoded)                                │
   │            │                                                            │
   │            │  decode (proto/MarketDataFeed.proto)                       │
   │            ▼                                                            │
   │   ┌─────────────────────┐    XADD     ┌──────────────────────────────┐  │
   │   │  upstox_ws producer │ ──────────▶ │  Redis Stream market:ticks   │  │
   │   │  (or simulator)     │   HSET      │  Redis Hash  market:latest   │  │
   │   └─────────────────────┘             │  (per-symbol O(1) snapshot)  │  │
   │                                       └──────────────┬───────────────┘  │
   │                                                      │ XREADGROUP        │
   │                                              ┌───────▼────────┐         │
   │                                              │ consumer (200) │         │
   │                                              │  batch INSERT  │         │
   │                                              └───────┬────────┘         │
   │                                                      ▼                  │
   │                                       ┌──────────────────────────┐      │
   │                                       │  bronze.market_ticks     │      │
   │                                       │  TimescaleDB hypertable  │      │
   │                                       │  retention: 30d          │      │
   │                                       └──────────────┬───────────┘      │
   │                                                      │ time_bucket(1m)  │
   │                                                      │ every 60s        │
   │                                                      ▼                  │
   │                                       ┌──────────────────────────┐      │
   │                                       │  silver.ohlcv_1min       │      │
   │                                       │  upsert OHLCV bars       │      │
   │                                       └──────────────┬───────────┘      │
   │                                                      │ TimescaleDB      │
   │                                                      │ continuous       │
   │                                                      │ aggregate        │
   │                                                      ▼                  │
   │                                       ┌──────────────────────────┐      │
   │                                       │  gold.ohlcv_5min         │      │
   │                                       │  gold.ohlcv_daily        │      │
   │                                       └──────────────────────────┘      │
   └─────────────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────────────────┐
   │  EOD HISTORICAL PIPELINE                                                │
   │                                                                         │
   │   In-process scheduler (api container)                                  │
   │   ──── every weekday 16:00 IST ────▶                                    │
   │                                                                         │
   │   Prefect @flow eod_pipeline                                            │
   │     ├── yfinance fetch (incremental via ops.data_catalog watermark)     │
   │     ├── UPSERT raw.historical_prices                                    │
   │     ├── quality_gate (hard + soft checks)                               │
   │     ├── compute_signals → analytics.daily_signals (SMA-20/50/200)       │
   │     ├── update watermark                                                │
   │     └── log_ingestion → ops.ingestion_log + ops.pipeline_metrics        │
   └─────────────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────────────────┐
   │  SERVING                                                                │
   │                                                                         │
   │   FastAPI (port 8000) — single-process async, asyncpg pool              │
   │     /api/backtest           Vectorized backtest (5 strategies)          │
   │     /api/live/quotes        Redis-first LTP with EOD fallback           │
   │     /api/live/vix           India VIX + regime band (Redis-first)       │
   │     /api/live/prices/{sym}  EOD series + live intraday tail             │
   │     /api/live/signals       Macro signal feed from live quotes          │
   │     /api/correlation/*      Cross-asset analytics (matrix/rolling/...)  │
   │     /api/quality/audit      Per-ticker quality audit                    │
   │     /api/health/pipeline    Medallion + live tick rate snapshot         │
   │     /api/ingest/*           Manual flow triggers + audit log            │
   │     /api/universe           User ticker management + on-demand backfill │
   │     /api/auth/{login,...}   Upstox OAuth2                               │
   │                                                                         │
   │   React UI (5173)       Grafana (3000)        Prefect UI (4200)         │
   └─────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Database** | TimescaleDB (PostgreSQL 16) | Medallion warehouse with hypertables, continuous aggregates, retention policies |
| **Message Broker** | Redis 7 (Streams + Hash) | Decoupled live tick ingestion (`market:ticks`) + O(1) latest-quote lookups (`market:latest`) |
| **Backend** | FastAPI + Uvicorn (Python 3.12) | Async API, asyncpg pool, in-process EOD scheduler, mounted routers |
| **Orchestration** | Prefect 3 | EOD flow + backfill + quality audit DAGs with UI |
| **Observability** | Grafana | 4 auto-provisioned dashboards querying TimescaleDB |
| **Live Data** | **Upstox API V3** (WebSocket + REST) | Real-time NSE ticks (protobuf), India VIX, V3 instrument format |
| **Historical Data** | yfinance | Bulk EOD OHLCV backfill (10 NSE large-caps + 2 indices + macro series) |
| **Frontend** | React 19 + Vite | Backtest UI, Cross-Asset Monitor, Data Quality dashboard, embedded Grafana |
| **Charting** | Recharts + TradingView Lightweight Charts | Equity curves, correlations, monthly heatmaps, distributions |
| **Infra** | Docker Compose (7 containers) | Single-host deployment, ~1.4 GB RAM |
| **Testing** | pytest | Unit tests for backtest engine, costs, metrics, pipeline, correlation |

---

## Data Engineering Concepts Demonstrated

| Concept | Implementation |
|---------|---------------|
| **Medallion Architecture** | bronze (raw ticks) → silver (cleaned 1-min OHLCV, aggregated every 60s) → gold (5-min + daily TimescaleDB continuous aggregates) |
| **Real-Time Streaming ETL** | Upstox V3 WebSocket → Redis Streams → consumer worker → bronze hypertable |
| **Consumer Groups** | Redis `XREADGROUP` with at-least-once delivery, `XACK` after successful insert |
| **Idempotent Upserts** | `ON CONFLICT DO NOTHING` (bronze) / `DO UPDATE` (silver) — re-aggregating same bucket is safe |
| **Watermark-Driven Incremental Ingestion** | `ops.data_catalog.high_watermark` drives EOD incremental loads — polling-based, not log-based CDC |
| **Data Quality Gates** | Hard checks (OHLCV invariants, nulls) + soft checks (outliers, staleness) + gap detection using NIFTY50 as empirical NSE calendar |
| **Self-Healing Reconciliation** | Detects missing 1-min silver buckets during market hours (past a grace window so it doesn't race the aggregator), backfills them from the Upstox intraday-candle REST API, and UPSERTs `ON CONFLICT DO NOTHING` so real stream bars are never clobbered. Each row carries a `source` tag (`stream` vs `reconciled`) for lineage. Solves the dropped-tick problem when the WebSocket disconnects mid-session. |
| **DAG Orchestration** | Prefect flows: EOD pipeline, historical backfill, quality audit |
| **In-Process Scheduling** | Async scheduler inside FastAPI lifespan — invokes Prefect flows weekdays at 16:00 IST without a separate work pool |
| **Continuous Aggregates** | TimescaleDB-managed: `gold.ohlcv_5min` refreshed every 5 min, `gold.ohlcv_daily` every hour |
| **Retention Policies** | Auto-drop bronze chunks > 30 days, pipeline metrics > 90 days |
| **Schema Migrations** | 11 version-controlled SQL files (000–010) applied at first DB boot |
| **Live Quote Resolution** | `/api/live/quotes` prefers Redis ticks < 60s old, falls back to EOD with stale-days flag — frontend gets unified data with source labels |
| **Observability** | 4 Grafana dashboards + `/api/health/pipeline` endpoint surfacing live tick rate, layer counts, freshness |
| **Connection Pooling** | Shared asyncpg pool via FastAPI lifespan (not per-request) |
| **Token Persistence** | Upstox OAuth2 token stored in Redis with 1-year TTL, shared across containers |
| **Market-Aware Scheduling** | IST trading hours + NSE holiday calendar, stream window management |
| **Cross-Asset Analytics** | Pure pandas/numpy correlation engine (matrix/rolling/lead-lag/divergence), unit-testable without DB |

---

## Database Schema

### Medallion Layers

```
bronze.market_ticks          -- Raw live ticks (hypertable, 1-day chunks, 30-day retention)
    instrument_key, timestamp, ltp, volume, oi, bid_price, ask_price, bid_qty, ask_qty

silver.ohlcv_1min            -- Cleaned 1-min OHLCV (hypertable, 1-week chunks)
    instrument_key, bucket, open, high, low, close, volume, trade_count, quality_score
    -- Populated by pipeline.silver_aggregator every 60s (rolling 5-min window, idempotent UPSERT)

gold.ohlcv_5min              -- TimescaleDB continuous aggregate, refreshed every 5 min
gold.ohlcv_daily             -- TimescaleDB continuous aggregate, refreshed hourly
```

### Historical EOD Layer

```
raw.historical_prices        -- yfinance EOD OHLCV (hypertable, 1-year chunks)
    ticker, trade_date, open_price, high_price, low_price, close_price, volume

analytics.daily_signals      -- Computed signals from EOD
    ticker, trade_date, close, sma_20, sma_50, sma_200, daily_return
```

### Operations & Control Plane

```
ops.user_universe            -- Tracked tickers + backfill state
ops.data_catalog             -- Per-ticker watermark for incremental EOD loads
ops.ingestion_log            -- Audit trail for every pipeline run
ops.pipeline_metrics         -- Time-series telemetry for Grafana (hypertable, 90-day retention)
```

### Migrations (applied on first boot)

```
000_create_raw_schema.sql          006_create_gold_views.sql
001_create_ops_schema.sql          007_create_pipeline_metrics.sql
002_create_analytics_schema.sql    008_create_user_universe.sql
003_enable_timescaledb.sql         009_retention_policies.sql
004_create_bronze_schema.sql       010_silver_source_column.sql
005_create_silver_schema.sql
```

---

## Docker Compose Services

| # | Service | Image | Port | Purpose |
|---|---------|-------|------|---------|
| 1 | `timescaledb` | `timescale/timescaledb:latest-pg16` | 5432 | Warehouse |
| 2 | `redis` | `redis:7-alpine` | 6379 | Tick stream + latest-quote hash |
| 3 | `api` | `python-engine` (FastAPI) | 8000 | REST API + in-process EOD scheduler |
| 4 | `pipeline-worker` | `python-engine` (worker) | — | producer + consumer + silver aggregator |
| 5 | `prefect-server` | `prefecthq/prefect:3-latest` | 4200 | Orchestration UI + flow monitoring |
| 6 | `grafana` | `grafana/grafana:latest` | 3000 | Observability dashboards |
| 7 | `client` | React/Vite | 5173 | Frontend |

All services have health checks. Startup order managed via `depends_on: condition: service_healthy`.

---

## Quick Start

### Prerequisites
- Docker Desktop
- 16 GB RAM recommended
- Upstox API credentials (optional — simulator mode works without)

### 1. Configure
```bash
git clone https://github.com/Adhi-opp/TradeRetro.git
cd TradeRetro
cp .env.example .env
# Edit .env: UPSTOX_CLIENT_ID, UPSTOX_CLIENT_SECRET if you have them
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
|----|-----|
| Frontend | http://localhost:5173 |
| API docs (Swagger) | http://localhost:8000/docs |
| Prefect UI | http://localhost:4200 |
| Grafana | http://localhost:3000 (admin / traderetro) |

### 5. (Optional) Authenticate Upstox

```bash
# Open in browser, log in to Upstox, approve
open http://localhost:8000/api/auth/login
```

Token persists in Redis for 1 year. To switch from simulator to real ticks:

```bash
# Edit .env: PIPELINE_MODE=live
docker compose up -d pipeline-worker
```

Worker will auto-connect at the next NSE open (9:00 IST, Mon-Fri).

---

## Pipeline Components

### Live tick pipeline (`pipeline-worker` container, all async tasks)

| Task | What it does |
|------|--------------|
| `pipeline.upstox_ws.produce` | Upstox V3 WS → decode protobuf → XADD to `market:ticks` + HSET `market:latest` |
| `pipeline.simulator.run_simulator` | Dev-mode fallback: bootstraps base prices from EOD warehouse, oscillates within ±0.05% |
| `pipeline.consumer.consume_loop` | `XREADGROUP` (batch 200) → batch INSERT into `bronze.market_ticks` → XACK |
| `pipeline.silver_aggregator.run_aggregator_loop` | Every 60s: re-aggregate last 5 min of bronze ticks into `silver.ohlcv_1min` (idempotent UPSERT) |
| `pipeline.reconciliation.run_reconciler_loop` | **(live only)** Every 3 min during market hours: detect missing 1-min silver buckets and patch them from the Upstox intraday-candle REST API — self-heals WebSocket drops |

The worker runs in one of three modes via `PIPELINE_MODE`:
- `simulate` — simulator + consumer + silver aggregator (default, no Upstox needed)
- `live` — upstox_ws producer + consumer + silver aggregator + **reconciler**
- `consumer_only` — consumer + silver aggregator (producer external)

### EOD pipeline (`api` container, scheduled async task)

`services.scheduler.run_eod_scheduler` runs inside the FastAPI lifespan. Computes the next Mon-Fri 16:00 IST slot, sleeps until then, invokes the Prefect-decorated `flows.eod_pipeline.eod_pipeline` flow, then re-computes for the next day. Skip weekends.

Inside the flow per ticker:
```
fetch_daily_candle  → yfinance, incremental via ops.data_catalog watermark
upsert_raw_prices   → INSERT into raw.historical_prices
quality_gate        → hard + soft checks
compute_signals     → SMA-20/50/200, daily returns → analytics.daily_signals
update_watermark    → advance ops.data_catalog.high_watermark
log_ingestion       → ops.ingestion_log + emit pipeline_metrics
```

### Data Quality

Hard checks (block the pipeline):
- OHLCV invariant: `high >= low`, `high >= open`, `high >= close`
- Null / non-positive price detection
- Future-dated rows

Soft checks (log warnings, don't block):
- Volume non-positive
- High/low vs open/close inconsistencies

Gap detection uses **NIFTY50.NS as the empirical NSE trading calendar** — a date is a gap only if NIFTY traded on it but this ticker didn't. No hardcoded holiday list needed; NSE holidays are detected automatically. Forex/commodity tickers (USDINR, CRUDE) that trade on Indian holidays don't generate false positives.

### Tracked Instruments (live subscription)

**Equities (10 NSE large-caps):** RELIANCE, SBIN, ICICIBANK, HDFCBANK, TCS, ITC, BHARTIARTL, BAJFINANCE, HCLTECH, INFY

**Indices:** NIFTY 50, BANK NIFTY, **India VIX** (V3-only instrument: `NSE_INDEX|India VIX`)

EOD historical backfill additionally covers: AXISBANK, USDINR, CRUDE.

---

## Live Quote Resolution

`GET /api/live/quotes?symbols=NIFTY50.NS&symbols=RELIANCE.NS` returns a unified payload:

```json
{
  "quotes": [
    { "symbol": "NIFTY50.NS", "last": 25109.33, "prev_close": 25080.21,
      "change_pct": 0.116, "as_of": "2026-05-17T10:32:00+05:30",
      "source": "upstox", "tick_age_seconds": 1.2, "stale_days": 0 },
    { "symbol": "USDINR", "last": 84.21, "prev_close": 84.18,
      "change_pct": 0.036, "as_of": "2026-05-16",
      "source": "eod", "tick_age_seconds": null, "stale_days": 1 }
  ],
  "source": "mixed"
}
```

Resolution order per symbol:
1. **Fresh Redis tick** (`market:latest` hash, age < 60s) — live LTP with prev close from EOD
2. **EOD fallback** — latest close from `raw.historical_prices` with `stale_days` flag

The same Redis-first logic is used by `/api/live/vix` and (for chart series) `/api/live/prices/{symbol}`, which appends today's live LTP as a final point flagged with `live: true` if EOD hasn't ingested today yet.

---

## API Endpoints

### Backtesting
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/backtest` | Vectorized backtest (MA Crossover, RSI, MACD, Bollinger, Donchian) — next-bar-open fills |
| `POST` | `/api/backtest/sweep` | Parameter sweep — vary 2 params, returns 2D metric grid |
| `POST` | `/api/backtest/wfa` | Walk-forward analysis — rolling train/test, OOS stitching, efficiency ratio + overfit verdict |
| `GET` | `/api/signals/unified/{ticker}` | Strategy-aware indicators (RSI, MACD, Bollinger, Donchian, arbitrary SMA periods) attached to a price series — drives the Backtest chart overlays |

### Live Market Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/live/quotes?symbols=...` | Redis-first LTP with EOD fallback + source labels |
| `GET` | `/api/live/prices/{symbol}?lookback_days=N` | EOD chart series + live intraday tail |
| `GET` | `/api/live/vix` | India VIX live (Redis-first) + regime band + trading advice |
| `GET` | `/api/live/signals` | Macro signal feed: divergence, USD/INR spikes, VIX alerts, risk-off combos |

### Data Quality
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/quality/audit?recent=true\|false` | Per-ticker quality audit: hard fails, soft warnings, gaps, staleness — sorted by severity |
| `GET` | `/api/quality/audit/{ticker}` | Drill-down quality audit for one ticker |

### Reconciliation (self-healing)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reconcile/gaps` | Dry run — missing 1-min silver buckets per instrument for today's session |
| `POST` | `/api/reconcile` | Detect gaps and patch them from the Upstox intraday-candle REST API (idempotent, `source='reconciled'`) |

### Cross-Asset Correlation
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/correlation/matrix` | N×N Pearson heatmap on log-returns, window 10/20/60d |
| `GET` | `/api/correlation/rolling` | Rolling correlation base vs peers — exposes regime breaks |
| `GET` | `/api/correlation/leadlag` | Lagged-correlation proxy (**not** Granger causality) |
| `GET` | `/api/correlation/divergence` | Cumulative-% series for heavyweight divergence detection |

### Ingestion (manual triggers)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ingest/eod` | Trigger EOD pipeline for specified or default tickers |
| `POST` | `/api/ingest/backfill` | Trigger historical backfill (yfinance) |
| `POST` | `/api/ingest/quality-audit` | Trigger quality audit flow |
| `GET` | `/api/ingest/status/{flow_id}` | Check triggered flow status |
| `GET` | `/api/ingest/flows` | List recent triggered flows |
| `GET` | `/api/ingest/history` | Audit log from `ops.ingestion_log` |

### Universe Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/universe` | List tickers with coverage stats |
| `POST` | `/api/universe` | Add a ticker, trigger on-demand backfill |
| `DELETE` | `/api/universe/{symbol}` | Remove from universe |
| `GET` | `/api/universe/resolve` | Normalize + validate free-text ticker |

### Auth (Upstox OAuth2)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/login` | Redirect to Upstox consent page |
| `GET` | `/api/auth/callback` | OAuth callback — exchanges code, stores token in Redis |
| `GET` | `/api/auth/status` | `{ authenticated: true\|false }` |
| `POST` | `/api/auth/token` | Manually inject an access token |

### Health & Observability
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | DB + Redis status, overall health |
| `GET` | `/api/health/pipeline` | Medallion snapshot: bronze/silver/gold counts, live tick rate, freshness per layer |

---

## Backtesting Engine

### Supported Strategies

Five strategies that are statistically meaningful on **daily** bars. (Intraday-only
strategies — Opening Range Breakout, session-anchored VWAP reversion — were
deliberately removed: they produce meaningless signals on daily EOD data and
belong in a separate intraday engine, not bolted onto the daily evaluator.)

| Strategy | Signal | Key Parameters |
|----------|--------|----------------|
| Moving Average Crossover | Golden / death cross | Short period, long period |
| RSI | Overbought / oversold | Period, overbought, oversold |
| MACD | Signal-line crossover | Fast, slow, signal periods |
| Bollinger Breakout | Band break + reentry | Period, std dev |
| Donchian Breakout | Close breaks the **prior** N-day high / low (channel is `shift(1)`'d so the current bar is excluded) | Channel period |

### Execution Model

Signals are computed on a bar's **close**, but orders fill at the **next bar's
open** — you can't trade at a close you only learn once the bar is over. This
removes same-bar look-ahead bias. A signal on the final bar simply never fills.

### Risk Model (optional)

Per-trade **position sizing + stop-loss**. Set `riskPct` + `stopLossPct` and the
engine sizes each position so a stop-out costs exactly `riskPct` of equity
(`position = riskPct·equity / stopLossPct`). Stops are resting orders → they fill
**intrabar** (not look-ahead); a gap-through fills at the open. Each trade records
an `exitReason` (`signal` / `stop` / `force_close`). With no risk params the engine
runs all-in (legacy behavior), so the metric is opt-in.

### Walk-Forward Analysis

The parameter sweep optimizes in-sample, which curve-fits. WFA proves (or
disproves) out-of-sample robustness: for each rolling fold it optimizes candidate
params on a **train** window, then tests the winner on the next, unseen **test**
bars; the OOS segments are stitched into one continuous equity curve. The headline
is the **walk-forward efficiency ratio** (aggregate OOS metric ÷ mean in-sample
metric) and a verdict (`robust` / `marginal` / `overfit`). Reuses the same engine,
so OOS runs honor next-bar-open fills, costs, and the risk model. *(Example: MA
crossover on 10y RELIANCE — in-sample Sharpe 0.6, OOS Sharpe −1.1, efficiency
−1.9 → **overfit**, exactly as WFA should catch.)*

### Cost Model

Realistic Indian equity cost model: STT, stamp duty, GST, brokerage, SEBI turnover fee, exchange transaction charges. Deterministic slippage with seeded RNG. Apply via the `applyCosts` toggle on the Backtest tab.

### Performance Analytics (Client-Side)

Computed in the browser from the equity curve + trade log (no extra round-trip): Sharpe, Sortino, Calmar, max drawdown + duration, VaR 95%, monthly heatmap, return distribution histogram, trade analytics (win rate, profit factor, expectancy, streaks), alpha vs buy-and-hold.

---

## Frontend (React)

### Backtest Tab
- Strategy config (5 strategies, full parameter exposure)
- Live ticker autocomplete with yfinance metadata
- Equity curve + drawdown plot
- Monthly returns heatmap, return distribution
- 8-tile risk metrics grid
- Trade table with CSV export
- Gross / Net (with Indian taxes) toggle

### Cross-Asset Monitor Tab
- Live ticker row (Redis-first, polls every 15s)
- India VIX gauge + regime band (Low/Normal/Elevated/High) with advice
- Macro signal feed (auto-polled every 30s)
- Price charts with live tail (`LIVE` badge on the current point)
- 4 correlation panels: matrix, rolling, lead-lag, divergence

### Data Quality Tab (gear menu)
- **Medallion Health card**: live tick rate, bronze/silver/gold/raw counts, freshness per layer (auto-refresh 5s)
- **Quality Gate card**: per-ticker hard fails / soft warnings / gaps / staleness with severity badges
- Coverage stats (backfill completion, total rows, freshness)
- Ticker inventory table with date ranges and quality bars

### Pipeline Tab (gear menu)
- Embedded Grafana iframe pointing at the auto-provisioned Pipeline Health dashboard

---

## Grafana Dashboards (auto-provisioned)

| Dashboard | What it shows | Source tables |
|-----------|---------------|---------------|
| **Pipeline Health** | Run counts, success rate, rows ingested over time | `ops.ingestion_log`, `ops.pipeline_metrics` |
| **Market Data** | Tick rate, latest prices, volume, daily closes | `bronze.market_ticks`, `silver.ohlcv_1min`, `raw.historical_prices` |
| **Data Quality** | Stale tickers, DQ failures, gap analysis | Gap detection via window functions |
| **System Metrics** | Hypertable sizes, chunk details, DB overview | `timescaledb_information.*`, `pg_total_relation_size()` |

Grafana is configured for anonymous read access + iframe embedding (used in the React Pipeline tab).

---

## Project Structure

```
TradeRetro/
├── docker-compose.yml              # 7-service orchestration
├── .env.example                    # Environment template
├── README_TR.md
│
├── python-engine/
│   ├── main.py                     # FastAPI app + lifespan (DB pool, Redis, EOD scheduler)
│   ├── config.py                   # pydantic-settings
│   ├── Dockerfile
│   ├── requirements.txt
│   │
│   ├── routers/                    # API endpoints
│   │   ├── backtest.py
│   │   ├── live.py                 # /api/live/{quotes,prices,vix,signals}
│   │   ├── signals.py              # /api/signals/unified/{ticker} — strategy-aware indicators
│   │   ├── quality.py              # /api/quality/audit + /audit/{ticker}
│   │   ├── correlation.py
│   │   ├── ingestion.py
│   │   ├── universe.py
│   │   ├── auth.py
│   │   └── health.py               # /api/health + /api/health/pipeline
│   │
│   ├── engine/                     # Vectorized backtest engine
│   │   ├── simulation.py
│   │   ├── strategies.py           # 5 daily strategies
│   │   ├── indicators.py
│   │   ├── costs.py                # Indian equity cost model
│   │   ├── metrics.py
│   │   └── corr_engine.py          # Pure pandas/numpy correlation analytics
│   │
│   ├── services/                   # Shared backend logic
│   │   ├── db.py                   # asyncpg pool
│   │   ├── redis_client.py         # Streams + latest-quote hash helpers
│   │   ├── upstox_client.py        # OAuth2 + V3 WebSocket URL retrieval
│   │   ├── scheduler.py            # In-process EOD scheduler (16:00 IST weekdays)
│   │   ├── data_loader.py
│   │   └── ticker_resolver.py
│   │
│   ├── pipeline/                   # Streaming pipeline
│   │   ├── upstox_ws.py            # V3 WebSocket producer
│   │   ├── simulator.py            # Bootstraps base prices from EOD; bounded oscillation
│   │   ├── consumer.py             # Redis → bronze
│   │   ├── silver_aggregator.py    # bronze → silver every 60s (Medallion)
│   │   ├── worker.py               # Worker entry point (multi-task asyncio)
│   │   ├── market_hours.py         # IST trading hours + NSE holiday calendar
│   │   └── quality.py              # Hard/soft DQ checks + gap detection
│   │
│   ├── flows/                      # Prefect DAGs
│   │   ├── eod_pipeline.py
│   │   ├── historical_backfill.py
│   │   └── quality_check.py
│   │
│   ├── models/
│   │   ├── requests.py
│   │   └── responses.py
│   │
│   ├── migrations/                 # 10 versioned SQL files (000–009)
│   │   ├── 000_create_raw_schema.sql
│   │   ├── 001_create_ops_schema.sql
│   │   ├── 002_create_analytics_schema.sql
│   │   ├── 003_enable_timescaledb.sql
│   │   ├── 004_create_bronze_schema.sql
│   │   ├── 005_create_silver_schema.sql
│   │   ├── 006_create_gold_views.sql
│   │   ├── 007_create_pipeline_metrics.sql
│   │   ├── 008_create_user_universe.sql
│   │   └── 009_retention_policies.sql
│   │
│   ├── proto/                      # Upstox protobuf definition
│   │   └── MarketDataFeed.proto
│   │
│   └── tests/
│       ├── test_simulation.py
│       ├── test_costs.py
│       ├── test_metrics.py
│       ├── test_pipeline.py
│       ├── test_routers.py
│       └── test_correlation.py
│
├── client/                         # React frontend (Vite)
│   ├── src/components/
│   │   ├── Dashboard.jsx
│   │   ├── LeftPane.jsx
│   │   ├── RightPane.jsx
│   │   ├── StrategyForm.jsx
│   │   ├── CrossAssetMonitor.jsx       # Live ticker + VIX + signals + correlation panels
│   │   ├── DataQualityDashboard.jsx    # Medallion Health + Quality Gate + ticker inventory
│   │   ├── PipelineDashboard.jsx       # Embedded Grafana iframe
│   │   ├── EquityChart.jsx
│   │   ├── DrawdownChart.jsx
│   │   ├── MonthlyHeatmap.jsx
│   │   ├── ReturnDistribution.jsx
│   │   ├── RiskMetricsGrid.jsx
│   │   ├── TradeStats.jsx
│   │   ├── TradeTable.jsx
│   │   └── ...
│   ├── src/utils/performance.js        # Client-side risk metrics
│   ├── Dockerfile
│   └── package.json
│
└── grafana/
    ├── provisioning/
    │   ├── datasources/timescaledb.yml
    │   └── dashboards/default.yml
    └── dashboards/
        ├── pipeline_health.json
        ├── market_data.json
        ├── data_quality.json
        └── system_metrics.json
```

---

## Environment Variables

```bash
# TimescaleDB (Compose overrides DATABASE_URL with the internal hostname)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/traderetro_raw

# Redis
REDIS_URL=redis://localhost:6379

# Upstox API V3 (https://api.upstox.com/developer)
UPSTOX_CLIENT_ID=your_client_id
UPSTOX_CLIENT_SECRET=your_client_secret
UPSTOX_REDIRECT_URI=http://127.0.0.1:8000/api/auth/callback
UPSTOX_ACCESS_TOKEN=               # Optional: inject directly instead of OAuth

# Prefect
PREFECT_API_URL=http://localhost:4200/api

# Pipeline worker
PIPELINE_MODE=simulate             # simulate | live | consumer_only
SIMULATE_RATE=10                   # Ticks/sec in simulate mode

# API
HOST=0.0.0.0
PORT=8000

# Optional: disable in-process EOD scheduler (e.g. for tests or multi-replica deploys)
DISABLE_EOD_SCHEDULER=
```

---

## Operations

### Daily startup
```powershell
docker compose up -d
# Open http://localhost:5173
```

### Common ops
```powershell
docker compose ps                          # Service status
docker compose logs -f api                 # Tail API logs
docker compose logs -f pipeline-worker     # Tail worker logs
docker compose restart api                 # Restart after .env change
docker compose up -d --build api           # Rebuild after Python change
docker compose up -d --build client        # Rebuild after React change
docker compose down                        # Stop everything
```

### Switching pipeline modes
Edit `.env`:
- `PIPELINE_MODE=simulate` → simulator (no auth required)
- `PIPELINE_MODE=live` → real Upstox V3 WebSocket (requires auth)

Then: `docker compose up -d pipeline-worker`

### Manual flow triggers
```bash
# Trigger EOD now (scheduler does this automatically Mon-Fri 16:00 IST)
curl -X POST http://localhost:8000/api/ingest/eod -H 'Content-Type: application/json' -d '{}'

# Historical backfill (e.g. add 5 years of SBIN)
curl -X POST http://localhost:8000/api/ingest/backfill \
  -H 'Content-Type: application/json' \
  -d '{"tickers": ["SBIN.NS"], "period": "5y"}'

# Quality audit
curl http://localhost:8000/api/quality/audit?recent=false
```

### Inspecting the warehouse
```bash
docker exec -it traderetro-timescaledb-1 psql -U postgres -d traderetro_raw

# Hypertables
\dt+ bronze.* silver.* gold.* raw.*
SELECT hypertable_name, num_chunks FROM timescaledb_information.hypertables;

# Retention + continuous-aggregate policies
SELECT * FROM timescaledb_information.jobs;
```

---

## Testing

```bash
cd python-engine
pip install -r requirements.txt
python -m pytest tests/ -v
```

| File | Covers |
|------|--------|
| `test_simulation.py` | Backtest engine: report structure, metric sanity, determinism |
| `test_costs.py` | Indian cost model: STT, stamp duty, GST, brokerage, slippage |
| `test_metrics.py` | Sharpe, max drawdown, CAGR, alpha, information ratio |
| `test_pipeline.py` | Market hours, quality checks, flow imports |
| `test_routers.py` | FastAPI endpoint smoke tests |
| `test_correlation.py` | Correlation engine: matrix, rolling, lead-lag, divergence |

Tests stub Redis / asyncpg / Prefect via `sys.modules` so they run without Docker.

---

## License

MIT
