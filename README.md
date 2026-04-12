# TradeRetro

A full-stack trading strategy backtester with a Python data engineering pipeline, built to demonstrate production-grade data practices on real NSE market data.

## Architecture

```
                          +------------------+
                          |  Yahoo Finance   |
                          +--------+---------+
                                   |
                    +--------------v---------------+
                    |   python-quant-engine        |
                    |   (Ingestion Pipeline)       |
                    |                              |
                    |  Watermark CDC               |
                    |  Data Quality Gate           |
                    |  Structured Logging          |
                    +--------------+---------------+
                                   |
                    +--------------v---------------+
                    |        PostgreSQL             |
                    |                              |
                    |  raw.historical_prices       |  Bronze
                    |  analytics.daily_signals     |  Gold
                    |  ops.data_catalog            |  Control Plane
                    |  ops.ingestion_log           |  Audit Trail
                    +---------+----+----+----------+
                              |    |    |
              +---------------+    |    +----------------+
              |                    |                     |
    +---------v-------+  +---------v--------+  +---------v--------+
    | python-backtest  |  |   bs_detector    |  |  Express Gateway |
    | engine (:8001)   |  |   (:8000)        |  |  (:5000)         |
    +--------+---------+  +---------+--------+  +---------+--------+
              |                    |                      |
              +--------------------+----------------------+
                                   |
                    +--------------v---------------+
                    |     React Frontend (:5173)   |
                    +------------------------------+
```

## Data Engineering Concepts Demonstrated

| Concept | Implementation |
|---------|---------------|
| **Medallion Architecture** | `raw` (Bronze) -> `analytics` (Gold) schema separation |
| **Watermark-based CDC** | `ops.data_catalog.high_watermark` drives incremental loads |
| **Idempotent Upserts** | `ON CONFLICT DO NOTHING` / `DO UPDATE` prevents duplicates |
| **Data Quality Gates** | `quality.py` validates OHLCV invariants before signal compute |
| **Audit Logging** | `ops.ingestion_log` tracks every pipeline run with status/timing |
| **Schema Migrations** | Version-controlled SQL in `migrations/` (000, 001, 002) |
| **Structured Logging** | Python `logging` module replaces print() for observability |
| **Containerization** | `docker-compose.yml` orchestrates all 5 services + Postgres |
| **Integration Testing** | `pytest` end-to-end tests validate the full pipeline |

## Database Schemas

```
raw.historical_prices      -- Bronze: OHLCV landing zone from Yahoo Finance
analytics.daily_signals    -- Gold: SMA-20/50/200, daily returns
ops.data_catalog           -- Watermark state per ticker
ops.ingestion_log          -- Audit trail: run_id, timing, row counts, status
```

## Quick Start

### With Docker

```bash
docker compose up -d postgres
docker compose run ingestion --symbol RELIANCE.NS
docker compose up -d
```

### Without Docker

```bash
# 1. Start PostgreSQL and run migrations
cd python-quant-engine
PGPASSWORD=postgres bash migrations/run_migrations.sh

# 2. Ingest data
python -m src.ingestion.fetch_ohlcv --symbol RELIANCE.NS

# 3. Start services
cd ../python-backtest-engine && uvicorn main:app --port 8001 &
cd ../bs_detector && uvicorn bs_api:app --port 8000 &
cd ../server && npm start &
cd ../client && npm run dev
```

## Ingestion Pipeline

```
fetch_ohlcv.py
  |
  +-- get_watermark()         Check ops.data_catalog for last loaded date
  |
  +-- stream_ohlcv()          Fetch from Yahoo Finance (full or incremental)
  |
  +-- load_to_postgres()      Upsert into raw.historical_prices
  |                           Returns (rows_fetched, rows_inserted)
  |
  +-- run_quality_checks()    Validate OHLCV invariants (hard/soft checks)
  |
  +-- compute_and_store_signals()   SMA + daily returns -> analytics layer
  |
  +-- Update ops.ingestion_log + ops.data_catalog
```

### Pipeline CLI

```bash
# Default: incremental load using watermark
python -m src.ingestion.fetch_ohlcv --symbol RELIANCE.NS

# Force full reload
python -m src.ingestion.fetch_ohlcv --symbol RELIANCE.NS --period 10y

# Multiple tickers
python -m src.ingestion.fetch_ohlcv --symbol RELIANCE.NS --symbol TCS.NS --symbol INFY.NS

# Date range override
python -m src.ingestion.fetch_ohlcv --symbol RELIANCE.NS --start-date 2024-01-01 --end-date 2024-12-31
```

## Running Tests

```bash
cd python-quant-engine
pip install pytest
PGPASSWORD=postgres python -m pytest tests/ -v
```

```bash
cd python-backtest-engine
python -m pytest tests/ -v
```

## Project Structure

```
TradeRetro/
  python-quant-engine/          Data engineering pipeline
    migrations/                 Version-controlled SQL DDL
      000_create_raw_schema.sql
      001_create_ops_schema.sql
      002_create_analytics_schema.sql
    src/ingestion/
      fetch_ohlcv.py            Main pipeline: fetch, load, validate, transform
      quality.py                Data quality gate (hard/soft checks)
    tests/
      test_pipeline_integration.py

  python-backtest-engine/       Vectorized backtest engine (FastAPI)
    engine/                     Simulation, costs, metrics, indicators
    services/                   Data loader, Monte Carlo
    models/                     Pydantic request/response schemas
    tests/                      48 unit tests

  bs_detector/                  AI strategy verifier (FastAPI)
    bs_api.py                   Sandboxed code execution + truth scoring

  server/                       Express.js API gateway
  client/                       React + TailwindCSS frontend
  docker-compose.yml            Full-stack container orchestration
```

## Tech Stack

- **Pipeline**: Python 3.12, psycopg2, pandas, yfinance
- **Database**: PostgreSQL 16 (medallion architecture)
- **Backend**: FastAPI (Python), Express.js (Node)
- **Frontend**: React 19, Vite, TailwindCSS, Lightweight Charts
- **Testing**: pytest, Jest
- **Infra**: Docker Compose
