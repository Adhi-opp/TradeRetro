# TradeRetro

A high-throughput financial data pipeline that ingests NSE market data, persists it to a Medallion-architected TimescaleDB warehouse with Prefect orchestration, and serves a FastAPI-powered quantitative backtesting and cross-asset analytics UI.

Built as a Data Engineering portfolio project demonstrating production-grade ETL practices on real Indian equity market data.

---

## Architecture

```
Upstox WebSocket ──> Redis Streams ──> Consumer Worker ──> TimescaleDB
  (live NSE ticks)   (market:ticks)    (batch insert)      (Medallion)
                                            │
                                            v
                                     ┌─────────────┐
                                     │   Bronze     │  raw ticks
                                     │   Silver     │  cleaned 1min OHLCV
                                     │   Gold       │  continuous aggregates
                                     └──────┬──────┘
                                            │
  Prefect Server ──> EOD Pipeline ──> Quality Gates ──> Signal Compute
   (port 4200)       (daily flow)     (hard/soft)       (SMA/RSI/MACD)
                                            │
	                                     FastAPI Engine (port 8000)
	                                      /api/backtest
	                                      /api/signals/unified/{ticker}
	                                      /api/ingest/{eod,backfill,quality-audit}
	                                      /api/correlation/{matrix,rolling,leadlag,divergence}
	                                      /api/universe
	                                      /api/live/{quotes,prices,vix,signals}
	                                      /api/auth/{login,callback,status}
	                                      /api/health
                                            │
                          ┌─────────────────┼─────────────────┐
                          v                 v                 v
                      Grafana          React UI          Prefect UI
                     (port 3000)      (port 5173)       (port 4200)
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Database** | TimescaleDB (PostgreSQL 16 + time-series extension) | Medallion-architected warehouse with hypertables and continuous aggregates |
| **Message Broker** | Redis 7 (Streams) | Decoupled real-time tick ingestion via consumer groups |
| **Backend** | FastAPI + Uvicorn (Python 3.12) | Unified async API serving backtest, signals, ingestion, auth, correlation analytics |
| **Orchestration** | Prefect 3 | DAG-based ETL orchestration with UI, scheduling, and flow monitoring |
| **Observability** | Grafana | 4 auto-provisioned dashboards querying TimescaleDB directly |
| **Live Data** | Upstox API v2 (WebSocket + REST) | Real-time NSE market data feed (protobuf-encoded) |
| **Historical Data** | yfinance | Bulk historical OHLCV backfill for 10 NSE large-caps + macro series |
| **Frontend** | React 19 + Vite + TailwindCSS | Backtesting UI, cross-asset monitor, data quality views, correlation lab, embedded Grafana dashboards |
| **Charting** | Recharts + Lightweight Charts | Interactive charts for correlations, equity curves, monthly returns, distributions |
| **Infra** | Docker Compose (7 containers) | Full-stack containerized deployment, ~1.4GB RAM |
| **Testing** | pytest (80+ tests) | Unit tests, integration tests, endpoint tests, correlation engine tests with mocked infrastructure |

---

## Data Engineering Concepts Demonstrated

| Concept | Implementation |
|---------|---------------|
| **Medallion Architecture** | Bronze (raw ticks) -> Silver (cleaned 1min OHLCV) -> Gold (5min/daily continuous aggregates) |
| **Real-Time Streaming ETL** | Upstox WebSocket -> Redis Streams -> Consumer Worker -> TimescaleDB |
| **Consumer Groups** | Redis `XREADGROUP` with at-least-once delivery and `XACK` after DB insert |
| **Batch Inserts** | `executemany` with `ON CONFLICT DO NOTHING` for idempotent throughput |
| **Watermark-Based CDC** | `ops.data_catalog.high_watermark` drives incremental daily loads |
| **Idempotent Upserts** | `ON CONFLICT DO NOTHING` / `DO UPDATE` prevents duplicate rows |
| **Data Quality Gates** | Hard checks (OHLCV invariants, null detection) and soft checks (outlier, staleness) |
| **DAG Orchestration** | Prefect flows: EOD pipeline, historical backfill, quality audit |
| **Continuous Aggregates** | TimescaleDB auto-refreshed materialized views (5min, daily rollups) |
| **Schema Migrations** | 8 version-controlled SQL files (000-007) applied on container startup |
| **Observability** | 4 Grafana dashboards: pipeline health, market data, data quality, system metrics |
| **Connection Pooling** | Shared `asyncpg` pool via FastAPI lifespan (not per-request connections) |
| **Token Persistence** | Upstox OAuth2 tokens stored in Redis, shared across containers |
| **Market-Aware Scheduling** | IST market hours, NSE holiday calendar, stream window management |
| **Structured Logging** | Python `logging` module with named loggers per module |

---

## Database Schema

### Medallion Layers

```
bronze.market_ticks          -- Raw Upstox WebSocket ticks (hypertable, 1-day chunks)
    instrument_key, timestamp, ltp, volume, oi, bid_price, ask_price, bid_qty, ask_qty

silver.ohlcv_1min            -- Cleaned 1-minute OHLCV bars (hypertable, 1-week chunks)
    instrument_key, bucket, open, high, low, close, volume, trade_count, quality_score

gold.ohlcv_5min              -- Continuous aggregate: 5-minute rollup from silver
gold.ohlcv_daily             -- Continuous aggregate: daily rollup from silver
```

### Historical & Analytics

```
raw.historical_prices        -- Yahoo Finance OHLCV (hypertable, 1-year chunks)
    ticker, trade_date, open, high, low, close, adj_close, volume

analytics.daily_signals      -- Computed signals: SMA-20/50/200, daily returns
    ticker, trade_date, close, sma_20, sma_50, sma_200, daily_return
```

### Operations & Control Plane

```
ops.data_catalog             -- Watermark state per ticker (CDC driver)
    ticker, first_date, last_date, high_watermark, total_rows

ops.ingestion_log            -- Audit trail for every pipeline run
    run_id, ticker, load_type, status, rows_fetched, rows_inserted, error_message

ops.pipeline_metrics         -- Time-series metrics for Grafana (hypertable, 1-day chunks)
    metric_name, metric_value, labels (JSONB), recorded_at
```

---

## Docker Compose Services

| # | Service | Image | Port | Purpose |
|---|---------|-------|------|---------|
| 1 | `timescaledb` | `timescale/timescaledb:latest-pg16` | 5432 | TimescaleDB warehouse |
| 2 | `redis` | `redis:7-alpine` | 6379 | Tick stream broker |
| 3 | `api` | `python-engine` (FastAPI) | 8000 | Unified REST API |
| 4 | `pipeline-worker` | `python-engine` (consumer) | -- | Redis -> TimescaleDB consumer |
| 5 | `prefect-server` | `prefecthq/prefect:3-latest` | 4200 | Orchestration server + UI |
| 6 | `grafana` | `grafana/grafana:latest` | 3000 | Observability dashboards |
| 7 | `client` | React/Vite | 5173 | Frontend application |

All services include health checks. Startup order is managed via `depends_on` with `condition: service_healthy`.

---

## Quick Start

### Prerequisites

- Docker Desktop (with Docker Compose)
- 16GB RAM recommended
- Upstox API credentials (optional, for live data)

### 1. Clone and Configure

```bash
git clone https://github.com/Adhi-opp/TradeRetro.git
cd TradeRetro
cp .env.example .env
# Edit .env with your Upstox credentials (optional)
```

### 2. Start All Services

```bash
docker compose up -d
```

This starts all 7 containers. Migrations run automatically on first boot.

### 3. Verify

```bash
# Health check
curl http://localhost:8000/api/health

# Check TimescaleDB hypertables
docker exec -it traderetro-timescaledb-1 psql -U postgres -d traderetro_raw \
  -c "SELECT * FROM timescaledb_information.hypertables;"
```

### 4. Access UIs

| UI | URL |
|----|-----|
| **React Frontend** | http://localhost:5173 |
| **FastAPI Docs** | http://localhost:8000/docs |
| **Grafana Dashboards** | http://localhost:3000 (admin / traderetro) |
| **Prefect Orchestration** | http://localhost:4200 |

---

## API Endpoints

### Backtesting

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/backtest` | Run a vectorized backtest (MA Crossover, RSI, MACD) |
| `POST` | `/api/monte-carlo` | Run Monte Carlo simulation on backtest results |

### Signals & Chart Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/signals/unified/{ticker}` | OHLCV + SMA signals for chart widgets |

### Data Ingestion (Pipeline Control)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ingest/eod` | Trigger EOD pipeline for specified tickers |
| `POST` | `/api/ingest/backfill` | Trigger historical backfill from yfinance |
| `POST` | `/api/ingest/quality-audit` | Trigger data quality audit |
| `GET` | `/api/ingest/status/{flow_id}` | Check flow execution status |
| `GET` | `/api/ingest/flows` | List recent triggered flows |
| `GET` | `/api/ingest/history` | Ingestion audit log from `ops.ingestion_log` |

### Authentication (Upstox OAuth2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/login` | Redirect to Upstox OAuth consent page |
| `GET` | `/api/auth/callback` | Handle OAuth callback, store token in Redis |
| `GET` | `/api/auth/status` | Check authentication state |
| `POST` | `/api/auth/token` | Manually inject an access token |

### Correlation Lab (Cross-Asset Research)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/correlation/matrix` | N×N Pearson-correlation heatmap on log-returns · window-selectable (10/20/60d) |
| `GET` | `/api/correlation/rolling` | Rolling-window correlation of base vs peers · exposes regime breaks |
| `GET` | `/api/correlation/leadlag` | Lagged-correlation proxy (**NOT** Granger causality — per-peer best-lag bars with direction) |
| `GET` | `/api/correlation/divergence` | Normalized cumulative-% series for heavyweight divergence detection |

All four endpoints are **research-only** (no orders, no sizing), read from `raw.historical_prices`, and return `{"status": "insufficient_data", ...}` with HTTP 200 when the warehouse is too thin to compute.

### Live Market Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/live/quotes` | Latest close + prev close + pct change for symbol list |
| `GET` | `/api/live/prices/{symbol}` | Close price series for chart (configurable lookback: 30-750 days) |
| `GET` | `/api/live/vix` | Current India VIX level + regime band (Low/Normal/Elevated/High) with advice |
| `GET` | `/api/live/signals` | Computed macro signal feed: heavyweight divergence, USD/INR spikes, VIX alerts, risk-off combos |

### User Ticker Universe

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/universe` | List all tickers with coverage stats (backfill status, row count, date range) |
| `POST` | `/api/universe` | Add a ticker, trigger on-demand yfinance backfill if needed (returns job_id for polling) |
| `DELETE` | `/api/universe/{symbol}` | Remove from universe (warehouse data retained) |
| `GET` | `/api/universe/resolve` | Normalize + validate a free-text ticker input |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Database, Redis, and pipeline status |

---

## Pipeline Architecture

### Real-Time Pipeline (During Market Hours)

```
Upstox WebSocket (protobuf)
    │
    v
upstox_ws.py — decode ticks, push to Redis Stream
    │
    v
Redis Stream: market:ticks (capped at 500K entries)
    │
    v
consumer.py — XREADGROUP (batch 200), executemany INSERT
    │
    v
bronze.market_ticks (TimescaleDB hypertable)
```

- **Market-aware**: Only streams during NSE hours (9:00-15:40 IST)
- **Holiday-aware**: NSE holiday calendar with 15+ holidays/year
- **Fault-tolerant**: Consumer group guarantees at-least-once delivery
- **Idempotent**: `ON CONFLICT DO NOTHING` prevents duplicates on reprocessing

### EOD Pipeline (After Market Close)

Orchestrated by Prefect, runs daily ~16:00 IST:

```
eod_pipeline (Prefect @flow)
    │
    ├── fetch_daily_candle      — yfinance incremental via watermark
    ├── upsert_raw_prices       — INSERT into raw.historical_prices
    ├── quality_gate            — hard checks (OHLCV invariants) + soft checks (outliers)
    ├── compute_signals         — SMA-20/50/200, daily returns -> analytics.daily_signals
    ├── aggregate_ticks_to_silver — bronze ticks -> silver.ohlcv_1min
    ├── update_watermark        — ops.data_catalog high_watermark
    ├── log_ingestion           — ops.ingestion_log audit entry
    └── emit_metric             — ops.pipeline_metrics for Grafana
```

### Data Quality Gate

Hard checks (fail the pipeline):
- OHLCV invariant: `high >= low`, `high >= open`, `high >= close`
- Null/zero price detection
- Volume non-negative

Soft checks (log warnings):
- Price outlier detection (>20% daily move)
- Staleness check (gaps > 3 trading days)

### Tracked Instruments

**Equities (10 NSE large-caps):**
RELIANCE, SBIN, ICICIBANK, HDFCBANK, TCS, ITC, BHARTIARTL, BAJFINANCE, HCLTECH, INFY

**Indices:** NIFTY 50, BANK NIFTY

---

## Backtesting Engine

### Supported Strategies

| Strategy | Signals | Parameters |
|----------|---------|------------|
| **Moving Average Crossover** | Golden cross / death cross | Short period, long period |
| **RSI (Relative Strength Index)** | Overbought/oversold | RSI period, overbought level, oversold level |
| **MACD** | Signal line crossover | Fast period, slow period, signal period |

### Features

- Vectorized simulation over historical OHLCV data
- Realistic Indian equity cost model (STT, stamp duty, GST, brokerage, SEBI turnover fee, exchange fees)
- Deterministic slippage model with seeded RNG
- Monte Carlo simulation for strategy robustness testing
- Equity curve, trade log, and performance metrics (Sharpe, CAGR, max drawdown, alpha, information ratio)

---

## Grafana Dashboards

Four auto-provisioned dashboards connected directly to TimescaleDB:

| Dashboard | Panels | Key Queries |
|-----------|--------|-------------|
| **Pipeline Health** | Total runs, success rate, failures, rows ingested, runs over time | `ops.ingestion_log`, `ops.pipeline_metrics` |
| **Market Data** | Tick rate, live price, volume, daily closes, tick count by instrument | `bronze.market_ticks`, `silver.ohlcv_1min`, `raw.historical_prices` |
| **Data Quality** | Stale tickers, DQ failures, completeness, gap detection | Gap detection via `LEAD()` window function |
| **System Metrics** | Table sizes (`hypertable_size()`), chunk details, database overview | `timescaledb_information.chunks`, `pg_total_relation_size()` |

Grafana is configured for anonymous read access and iframe embedding (used in the React "Data Pipeline" tab).

---

## Cross-Asset Monitor & Correlation Lab

### Live Market Dashboard (Cross-Asset Monitor)

A research-focused tab displaying live EOD quotes, volatility regime, and macro signal feed. Consists of:

- **Live Ticker Row**: Latest close prices with daily % change for 7 selected symbols (NIFTY 50, BANK NIFTY, RELIANCE, HDFC BANK, ICICI BANK, USD/INR, CRUDE). Color-coded by asset class (equity, index, forex, commodity).
- **VIX Gauge + Regime**: Real-time India VIX level with regime band (Low < 13, Normal 13–20, Elevated 20–28, High > 28) and regime-specific trading advice.
- **Macro Signal Feed**: Automated alerts on heavyweight divergence, USD/INR spikes (>0.15%), VIX regime shifts, and risk-off combos (equities down + INR weakening).
- **Historical Price Charts**: 1-year EOD close series for NIFTY 50 and BANK NIFTY with lookback selector (30/60/120/250 days).

### Correlation Lab (Pure Pandas/Numpy Analytics)

Four research-only panels for cross-asset analysis, reading directly from `raw.historical_prices`:

| Panel | What it shows | Control |
|-------|---------------|---------|
| **Correlation Matrix** | N×N Pearson heatmap on log-returns, sparse tickers filtered via MIN_COVERAGE=0.8 | Window selector: 10/20/60 days |
| **Rolling Correlation** | Per-peer rolling correlation vs NIFTY 50 over time — exposes regime breaks | Window: 10/20/60d · Lookback: 120d |
| **Lead-Lag Proxy** | Horizontal bars: per-peer best lag `k` maximizing `\|corr(base_t, peer_{t-k})\|`. Positive `k` ⇒ peer leads. **NOT Granger causality** — see disclaimer. | Max lag: ±5 bars · Window: 60d |
| **Heavyweight Divergence** | Cumulative-% change from window start — shows if index strength is driven by heavyweights or breadth | Lookback: 30/60/120 days |

**Supported Universe**: 12 NSE equities (RELIANCE, HDFCBANK, ICICIBANK, SBIN, TCS, INFY, HCLTECH, ITC, BHARTIARTL, BAJFINANCE) + 2 indices (NIFTY50.NS, BANKNIFTY.NS) + 2 macro series (USDINR, CRUDE).

**Setup**: Macro tickers are optional; backfill before opening the Lab:
```bash
curl -X POST http://localhost:8000/api/ingest/backfill \
  -H 'Content-Type: application/json' \
  -d '{"tickers": ["USDINR", "CRUDE", "INDIAVIX"], "period": "2y"}'
```

**Math Layer**: Pure pandas/numpy in [`python-engine/engine/corr_engine.py`](python-engine/engine/corr_engine.py) — unit-testable without a database, runs in executor so the event loop never blocks.

---

## Data Quality & Coverage Monitoring

### Data Quality Dashboard

A dedicated UI tab showing warehouse health, ticker coverage, and ingestion freshness:

- **Coverage Stats**: # tickers backfilled / total, overall completion %, total rows, average rows/ticker.
- **Freshness Gauge**: Days since the most recent backfill, freshness badges (good/warning/critical).
- **Pipeline Status**: Health indicator (healthy/degraded/critical) based on completion %, auto-refreshing every 30s.
- **Ticker Inventory Table**: Per-ticker row count, date range (earliest–latest), backfill status (pending/running/completed/failed), staleness, and a quality % bar.

**Source**: Joins `ops.user_universe` with `raw.historical_prices` aggregations for real-time coverage insights.

---

## Client-Side Performance Analytics

All performance metrics are computed client-side in the browser after backtest, using the existing `equityCurve` and `trades` arrays—**no backend change required**. Deployed in [`client/src/utils/performance.js`](client/src/utils/performance.js).

### Metrics Computed

| Metric | Formula | Purpose |
|--------|---------|---------|
| **Sharpe Ratio** | `(mean_daily_return / stdev_daily_return) × √252` | Risk-adjusted return; rf=0 |
| **Sortino Ratio** | `(mean_daily_return / stdev_downside) × √252` | Downside-only volatility focus |
| **Calmar Ratio** | `CAGR / \|max_drawdown\|` | Recovery efficiency |
| **Max Drawdown Duration** | Days from peak to recovery | Longest consecutive underwater period |
| **Value-at-Risk (VaR 95%)** | 5th percentile of daily returns | Worst expected loss 95% of the time |
| **Monthly Returns** | Compound month-to-month | Monthly heatmap |
| **Return Distribution** | Histogram: 30 bins from min to max daily % | Distribution shape, skew |
| **Trade Analytics** | Win rate, profit factor, expectancy, streaks | Per-trade stats |

### Frontend Visualizations

- **Risk Metrics Grid**: 8 tiles (Sharpe, Sortino, Calmar, volatility, max DD, DD duration, VaR 95%, alpha vs B&H)
- **Underwater Plot**: Drawdown area chart with worst DD highlighted
- **Monthly Heatmap**: Year×Month grid, hot/cold cells by return, YTD sums
- **Return Distribution**: Bar chart with mean/VaR 95% annotations
- **Trade Stats Panel**: Wins/losses, profit factor, best/worst trade, streaks, avg holding period
- **Summary Ribbon**: Initial → final capital, total return, vs buy-hold comparison, strategy/date/days metadata

---

## Testing

### Run Tests Locally

```bash
cd python-engine
pip install -r requirements.txt
python -m pytest tests/ -v
```

### Run Tests Locally

```bash
cd python-engine
pip install -r requirements.txt
python -m pytest tests/ -v
```

### Test Suite (80+ tests)

| File | Tests | What It Covers |
|------|-------|---------------|
| `test_simulation.py` | 14 | Backtest engine: report structure, metric sanity, edge cases, determinism |
| `test_costs.py` | 12 | Indian cost model: STT, stamp duty, GST, brokerage, slippage |
| `test_metrics.py` | 15 | Financial metrics: Sharpe, max drawdown, CAGR, alpha, information ratio |
| `test_pipeline.py` | 15 | Market hours, quality checks, flow structure, Prefect DAG imports |
| `test_routers.py` | 10 | FastAPI endpoints: health, backtest, BS detector, ingestion triggers |
| `test_correlation.py` | 16+ | Correlation engine: matrix, rolling, lead-lag, divergence; router integration with mocked DB |

Tests run without Docker by stubbing heavy dependencies (Redis, asyncpg, Prefect) via `sys.modules`. Prefect-dependent tests auto-skip locally and pass in Docker.

---

## Project Structure

```
TradeRetro/
├── docker-compose.yml              # 7-service orchestration
├── .env.example                    # Environment variables template
├── README.md
│
├── python-engine/                  # Unified Python backend
│   ├── main.py                     # FastAPI app + lifespan (asyncpg pool + Redis)
│   ├── config.py                   # pydantic-settings configuration
│   ├── Dockerfile
│   ├── requirements.txt
│   │
│   ├── routers/                    # API endpoint handlers
│   │   ├── backtest.py             # POST /api/backtest, /api/monte-carlo
│   │   ├── signals.py              # GET /api/signals/unified/{ticker}
│   │   ├── ingestion.py            # Pipeline trigger + status endpoints
│   │   ├── correlation.py          # Cross-asset matrix, rolling, lead-lag, divergence
│   │   ├── universe.py             # User ticker universe + on-demand backfill
│   │   ├── live.py                 # EOD quote, VIX, and macro signal endpoints
│   │   ├── auth.py                 # Upstox OAuth2 flow
│   │   └── health.py              # GET /api/health
│   │
│   ├── engine/                     # Vectorized backtest engine + analytics
│   │   ├── simulation.py           # SimulationEngine — main backtest loop
│   │   ├── strategies.py           # MA Crossover, RSI, MACD signal evaluators
│   │   ├── indicators.py           # SMA, EMA, RSI, MACD computation
│   │   ├── costs.py                # Indian equity cost model (STT, GST, etc.)
│   │   ├── metrics.py              # Sharpe, CAGR, drawdown, alpha, IR
│   │   └── corr_engine.py          # Pure pandas/numpy: correlation, rolling, lead-lag, divergence
│   │
│   ├── services/                   # Shared business logic
│   │   ├── db.py                   # asyncpg connection pool (lifespan-managed)
│   │   ├── redis_client.py         # Redis Streams interface (XADD, XREADGROUP, XACK)
│   │   ├── upstox_client.py        # Upstox OAuth2 + WebSocket URL retrieval
│   │   ├── data_loader.py          # Historical data loading from TimescaleDB
│   │   ├── ticker_resolver.py      # Ticker normalization + yfinance metadata
│   │   ├── monte_carlo.py          # Monte Carlo simulation
│   │   └── redis_client.py         # Redis Streams interface
│   │
│   ├── pipeline/                   # Streaming data pipeline
│   │   ├── upstox_ws.py            # WebSocket producer -> Redis Streams
│   │   ├── consumer.py             # Redis Streams -> TimescaleDB (batch insert)
│   │   ├── worker.py               # Pipeline worker entry point
│   │   ├── simulator.py            # Tick simulator for development/testing
│   │   ├── market_hours.py         # NSE market hours + holiday calendar
│   │   └── quality.py              # Data quality checks (hard/soft)
│   │
│   ├── flows/                      # Prefect DAGs
│   │   ├── eod_pipeline.py         # EOD: fetch -> quality gate -> signals -> watermark
│   │   ├── historical_backfill.py  # yfinance bulk historical backfill
│   │   └── quality_check.py        # Scheduled quality audit across tickers
│   │
│   ├── models/                     # Pydantic request/response schemas
│   │   ├── requests.py
│   │   └── responses.py
│   │
│   ├── migrations/                 # Version-controlled SQL DDL (000-008)
│   │   ├── 000_create_raw_schema.sql
│   │   ├── 001_create_ops_schema.sql
│   │   ├── 002_create_analytics_schema.sql
│   │   ├── 003_enable_timescaledb.sql
│   │   ├── 004_create_bronze_schema.sql
│   │   ├── 005_create_silver_schema.sql
│   │   ├── 006_create_gold_views.sql
│   │   ├── 007_create_pipeline_metrics.sql
│   │   └── 008_create_user_universe.sql
│   │
│   ├── proto/                      # Upstox protobuf definitions
│   │   └── MarketDataFeed.proto
│   │
│   └── tests/                      # 80+ tests
│       ├── test_simulation.py
│       ├── test_costs.py
│       ├── test_metrics.py
│       ├── test_pipeline.py
│       ├── test_routers.py
│       └── test_correlation.py
│
├── client/                         # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx                   # Main layout
│   │   │   ├── LeftPane.jsx                    # Strategy config + mode toggle
│   │   │   ├── RightPane.jsx                   # Results display
│   │   │   ├── ChartWidget.jsx                 # TradingView Lightweight Charts
│   │   │   ├── EquityChart.jsx                 # Equity curve visualization
│   │   │   ├── StrategyForm.jsx                # Backtest parameter input
│   │   │   ├── MetricsCard.jsx                 # Performance metrics display
│   │   │   ├── CrossAssetMonitor.jsx           # Live quotes, VIX, signals, price charts
│   │   │   ├── DataQualityDashboard.jsx        # Warehouse coverage and freshness
│   │   │   ├── CorrelationMatrix.jsx           # Heatmap
│   │   │   ├── RollingCorrPanel.jsx            # Rolling correlation over time
│   │   │   ├── LeadLagPanel.jsx                # Lead-lag lagged correlation bars
│   │   │   ├── DivergencePanel.jsx             # Normalized cumulative %
│   │   │   ├── SummaryRibbon.jsx               # Capital, return, strategy metadata
│   │   │   ├── RiskMetricsGrid.jsx             # 8-tile risk metrics
│   │   │   ├── DrawdownChart.jsx               # Underwater plot
│   │   │   ├── MonthlyHeatmap.jsx              # Year×Month returns heatmap
│   │   │   ├── ReturnDistribution.jsx          # Daily return histogram
│   │   │   ├── TradeStats.jsx                  # Trade analytics grid
│   │   │   ├── TickerInput.jsx                 # Free-text with autocomplete
│   │   │   ├── TradeTable.jsx                  # Trade log with CSV export
│   │   │   ├── ErrorBoundary.jsx               # React error boundary
│   │   │   └── PipelineDashboard.jsx           # Embedded Grafana iframe
│   │   ├── App.jsx
│   │   ├── api.js                              # API client
│   │   ├── main.jsx
│   │   ├── index.css                           # TailwindCSS styles
│   │   ├── utils/
│   │   │   └── performance.js                  # Client-side analytics (Sharpe, Sortino, etc.)
│   │   └── assets/
│   ├── Dockerfile
│   ├── vite.config.js
│   └── package.json
│
└── grafana/                        # Grafana provisioning
    ├── provisioning/
    │   ├── datasources/
    │   │   └── timescaledb.yml     # Auto-provisioned TimescaleDB datasource
    │   └── dashboards/
    │       └── default.yml         # File-based dashboard provider
    └── dashboards/
        ├── pipeline_health.json    # Pipeline health dashboard (9 panels)
        ├── market_data.json        # Market data dashboard (9 panels)
        ├── data_quality.json       # Data quality dashboard (8 panels)
        └── system_metrics.json     # System metrics dashboard (10 panels)
```

**Root utilities:**
- `generate_pdf.py`: Creates a comprehensive TradeRetro_Documentation.pdf with 10+ sections, tables, and code samples. Useful for portfolio presentations.
- `python-engine/run_api_with_dummy_redis.py`: Stubs Redis and Prefect dependencies, allowing the API to boot without Docker. Useful for local development and demo environments.

---

## Environment Variables

```bash
# TimescaleDB
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/traderetro_raw

# Redis
REDIS_URL=redis://localhost:6379

# Upstox API (get from https://api.upstox.com/developer)
UPSTOX_CLIENT_ID=your_client_id_here
UPSTOX_CLIENT_SECRET=your_client_secret_here
UPSTOX_REDIRECT_URI=http://localhost:8000/api/auth/callback
UPSTOX_ACCESS_TOKEN=                    # Optional: inject directly instead of OAuth flow

# Prefect Orchestration
PREFECT_API_URL=http://localhost:4200/api

# Pipeline Worker
PIPELINE_MODE=simulate                  # simulate | live | consumer_only
SIMULATE_RATE=10                        # Ticks per second in simulate mode

# Server
HOST=0.0.0.0
PORT=8000
```

---

## Development

### Local Development (Without Docker)

```bash
cd python-engine
pip install -r requirements.txt

# Start the API (needs a running TimescaleDB and Redis)
uvicorn main:app --reload --port 8000

# Run tests (no infrastructure needed)
python -m pytest tests/ -v
```

### Running the Pipeline Worker

```bash
# In Docker (recommended)
docker compose up pipeline-worker

# Locally (needs Redis + TimescaleDB)
python -m pipeline.worker
```

### Triggering Flows via API

```bash
# Trigger EOD pipeline
curl -X POST http://localhost:8000/api/ingest/eod \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["RELIANCE.NS", "TCS.NS"]}'

# Trigger historical backfill
curl -X POST http://localhost:8000/api/ingest/backfill \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["SBIN.NS"], "period": "5y"}'

# Check flow status
curl http://localhost:8000/api/ingest/flows
```

### Connecting Upstox (Live Data)

1. Register at https://api.upstox.com/developer
2. Set `UPSTOX_CLIENT_ID` and `UPSTOX_CLIENT_SECRET` in `.env`
3. Start the stack: `docker compose up -d`
4. Visit http://localhost:8000/api/auth/login to authorize
5. The pipeline worker will automatically start streaming ticks during market hours

---

## License

MIT
