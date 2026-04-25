"""Generate TradeRetro project documentation PDF."""

from fpdf import FPDF


def _ascii(s):
    """Replace common unicode punctuation with ASCII equivalents for latin-1 fonts."""
    return (
        s.replace("\u2014", "-")   # em dash
         .replace("\u2013", "-")   # en dash
         .replace("\u2022", "*")   # bullet
         .replace("\u2018", "'")   # left single quote
         .replace("\u2019", "'")   # right single quote
         .replace("\u201c", '"')   # left double quote
         .replace("\u201d", '"')   # right double quote
         .replace("\u2192", "->")  # right arrow
         .replace("\u2190", "<-")  # left arrow
         .replace("\u2265", ">=")
         .replace("\u2264", "<=")
         .replace("\u2026", "...")
    )


class PDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, _ascii("TradeRetro - Project Documentation"), align="R")
        self.ln(4)
        self.set_draw_color(200, 200, 200)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, title):
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(20, 60, 120)
        self.ln(4)
        self.cell(0, 10, _ascii(title))
        self.ln(8)
        self.set_draw_color(20, 60, 120)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def sub_title(self, title):
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(40, 80, 140)
        self.ln(2)
        self.cell(0, 8, _ascii(title))
        self.ln(8)

    def sub_sub_title(self, title):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(60, 60, 60)
        self.ln(2)
        self.cell(0, 7, _ascii(title))
        self.ln(7)

    def body_text(self, text):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5.5, _ascii(text))
        self.ln(2)

    def code_block(self, text):
        self.set_font("Courier", "", 8.5)
        self.set_fill_color(245, 245, 245)
        self.set_text_color(30, 30, 30)
        x = self.get_x()
        self.set_x(x + 2)
        for line in _ascii(text).strip().split("\n"):
            self.cell(186, 5, "  " + line, fill=True)
            self.ln(5)
        self.ln(3)

    def table_row(self, cells, widths, bold=False, fill=False):
        self.set_font("Helvetica", "B" if bold else "", 9)
        if fill:
            self.set_fill_color(230, 240, 250)
        self.set_text_color(30, 30, 30)
        max_h = 6
        for i, (cell, w) in enumerate(zip(cells, widths)):
            self.cell(w, max_h, _ascii(str(cell)), border=1, fill=fill)
        self.ln(max_h)

    def bullet(self, text, indent=10):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        x = self.get_x()
        self.set_x(x + indent)
        self.cell(4, 5.5, "*")
        self.multi_cell(170 - indent, 5.5, _ascii(text))
        self.ln(1)


def build_pdf():
    pdf = PDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)

    # ─── Cover Page ────────────────────────────────────────
    pdf.add_page()
    pdf.ln(50)
    pdf.set_font("Helvetica", "B", 32)
    pdf.set_text_color(20, 60, 120)
    pdf.cell(0, 15, "TradeRetro", align="C")
    pdf.ln(18)
    pdf.set_font("Helvetica", "", 14)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(0, 8, "High-Throughput Financial Data Pipeline", align="C")
    pdf.ln(10)
    pdf.set_font("Helvetica", "I", 11)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 7, _ascii("Real-time NSE market data ingestion, Medallion-architected warehouse,"), align="C")
    pdf.ln(7)
    pdf.cell(0, 7, _ascii("Prefect-orchestrated ETL, and AI strategy verification"), align="C")
    pdf.ln(30)
    pdf.set_draw_color(20, 60, 120)
    pdf.line(60, pdf.get_y(), 150, pdf.get_y())
    pdf.ln(15)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(0, 7, "Adhiraj", align="C")
    pdf.ln(7)
    pdf.cell(0, 7, "BITS Pilani", align="C")
    pdf.ln(7)
    pdf.cell(0, 7, "April 2026", align="C")

    # ─── 1. Overview ────────────────────────────────────────
    pdf.add_page()
    pdf.section_title("1. Overview")
    pdf.body_text(
        "TradeRetro is a high-throughput financial data pipeline that ingests live NSE market data "
        "via the Upstox WebSocket API through Redis Streams, persists data to a Medallion-architected "
        "TimescaleDB warehouse with Prefect orchestration, and includes a vectorized backtesting engine "
        "with an AI strategy verification system that scores ChatGPT trading advice against real market data."
    )
    pdf.body_text(
        "The system demonstrates production-grade data engineering practices on real Indian equity market data, "
        "running as a fully containerized stack of 7 Docker services with automated schema migrations, "
        "data quality gates, and observability dashboards."
    )

    pdf.sub_title("Key Capabilities")
    pdf.bullet("Real-time tick ingestion from Upstox WebSocket (10 NSE large-caps + 2 indices)")
    pdf.bullet("Decoupled streaming via Redis Streams with consumer group guarantees")
    pdf.bullet("Medallion architecture: Bronze (raw ticks) -> Silver (1min OHLCV) -> Gold (aggregates)")
    pdf.bullet("Prefect-orchestrated EOD pipeline with data quality gates (hard + soft checks)")
    pdf.bullet("Watermark-based CDC for incremental historical data loading")
    pdf.bullet("Vectorized backtesting engine with 3 strategies and Monte Carlo simulation")
    pdf.bullet("AI strategy verifier (BS Detector) — sandbox-executes user code against real data")
    pdf.bullet("4 auto-provisioned Grafana dashboards for pipeline observability")
    pdf.bullet("73-test suite covering engine, costs, metrics, pipeline, and API endpoints")

    # ─── 2. Architecture ───────────────────────────────────
    pdf.add_page()
    pdf.section_title("2. System Architecture")
    pdf.code_block(
        "Upstox WebSocket --> Redis Streams --> Consumer Worker --> TimescaleDB\n"
        "  (live NSE ticks)   (market:ticks)    (batch insert)      (Medallion)\n"
        "                                            |\n"
        "                                            v\n"
        "                                     +-------------+\n"
        "                                     |   Bronze    |  raw ticks\n"
        "                                     |   Silver    |  cleaned 1min OHLCV\n"
        "                                     |   Gold      |  continuous aggregates\n"
        "                                     +------+------+\n"
        "                                            |\n"
        "  Prefect Server --> EOD Pipeline --> Quality Gates --> Signal Compute\n"
        "   (port 4200)       (daily flow)     (hard/soft)       (SMA/RSI/MACD)\n"
        "                                            |\n"
        "                                     FastAPI Engine (port 8000)\n"
        "                                            |\n"
        "                     +------------------+---+---+------------------+\n"
        "                     v                  v       v                  v\n"
        "                 Grafana           React UI  Prefect UI     API Docs\n"
        "                (port 3000)       (port 5173)(port 4200)  (port 8000/docs)"
    )

    pdf.sub_title("Data Flow Summary")
    pdf.body_text(
        "During market hours (9:00-15:40 IST), the Upstox WebSocket producer receives protobuf-encoded "
        "tick data for 10 NSE large-cap equities and 2 indices. Ticks are decoded and pushed to the "
        "Redis Stream 'market:ticks' (capped at 500K entries). A consumer worker reads batches of 200 "
        "messages via XREADGROUP, batch-inserts into bronze.market_ticks using executemany with ON CONFLICT "
        "DO NOTHING for idempotency, and acknowledges after successful DB insert."
    )
    pdf.body_text(
        "After market close (~16:00 IST), the Prefect-orchestrated EOD pipeline runs: fetches daily candles "
        "from yfinance (incremental via watermark), upserts to raw.historical_prices, runs quality gates, "
        "computes SMA signals, aggregates bronze ticks into silver 1-minute bars, updates watermarks, "
        "and emits pipeline metrics for Grafana."
    )

    # ─── 3. Tech Stack ─────────────────────────────────────
    pdf.add_page()
    pdf.section_title("3. Technology Stack")

    stack = [
        ("Layer", "Technology", "Purpose"),
        ("Database", "TimescaleDB (PG16)", "Medallion warehouse with hypertables + continuous aggregates"),
        ("Broker", "Redis 7 (Streams)", "Decoupled real-time tick ingestion via consumer groups"),
        ("Backend", "FastAPI + Uvicorn", "Unified async API (Python 3.12)"),
        ("Orchestration", "Prefect 3", "DAG-based ETL with UI, scheduling, flow monitoring"),
        ("Observability", "Grafana", "4 auto-provisioned dashboards on TimescaleDB"),
        ("Live Data", "Upstox API v2", "Real-time NSE WebSocket feed (protobuf-encoded)"),
        ("Historical", "yfinance", "Bulk historical OHLCV backfill"),
        ("Frontend", "React 19 + Vite", "Backtesting UI + embedded Grafana dashboards"),
        ("Charting", "Lightweight Charts", "TradingView candlestick charts with signal overlays"),
        ("Infra", "Docker Compose", "7 containers, ~1.4GB RAM"),
        ("Testing", "pytest", "73 tests — unit, integration, endpoint"),
    ]
    w = [28, 42, 120]
    for i, row in enumerate(stack):
        pdf.table_row(row, w, bold=(i == 0), fill=(i == 0))

    pdf.ln(5)
    pdf.sub_title("Python Dependencies")
    pdf.bullet("fastapi, uvicorn, pydantic, pydantic-settings  (API framework)")
    pdf.bullet("asyncpg  (async PostgreSQL driver with connection pooling)")
    pdf.bullet("redis  (async Redis client for Streams)")
    pdf.bullet("prefect  (workflow orchestration)")
    pdf.bullet("pandas, numpy  (data manipulation)")
    pdf.bullet("yfinance  (historical market data)")
    pdf.bullet("websockets, httpx, protobuf  (Upstox WebSocket + REST)")
    pdf.bullet("pytest, pytest-asyncio  (testing)")

    # ─── 4. Database Schema ─────────────────────────────────
    pdf.add_page()
    pdf.section_title("4. Database Schema (TimescaleDB)")

    pdf.sub_title("Medallion Layers")

    pdf.sub_sub_title("Bronze — Raw Ticks")
    pdf.code_block(
        "bronze.market_ticks  (hypertable, 1-day chunks)\n"
        "  instrument_key  VARCHAR(50)   NOT NULL\n"
        "  timestamp       TIMESTAMPTZ   NOT NULL\n"
        "  ltp             NUMERIC       NOT NULL\n"
        "  volume          BIGINT\n"
        "  oi              BIGINT\n"
        "  bid_price, ask_price    NUMERIC\n"
        "  bid_qty, ask_qty        BIGINT\n"
        "  ingested_at     TIMESTAMPTZ   DEFAULT NOW()"
    )

    pdf.sub_sub_title("Silver — Cleaned 1-Minute OHLCV")
    pdf.code_block(
        "silver.ohlcv_1min  (hypertable, 1-week chunks)\n"
        "  instrument_key  VARCHAR(50)   NOT NULL\n"
        "  bucket          TIMESTAMPTZ   NOT NULL\n"
        "  open, high, low, close    NUMERIC\n"
        "  volume          BIGINT\n"
        "  trade_count     INT\n"
        "  quality_score   SMALLINT      DEFAULT 100"
    )

    pdf.sub_sub_title("Gold — Continuous Aggregates")
    pdf.code_block(
        "gold.ohlcv_5min   — 5-minute rollup (auto-refresh every 5 min)\n"
        "gold.ohlcv_daily  — daily rollup (auto-refresh every 1 hour)\n"
        "\n"
        "Both use TimescaleDB continuous aggregates:\n"
        "  first(open, bucket), max(high), min(low), last(close, bucket), sum(volume)"
    )

    pdf.sub_title("Historical & Analytics")
    pdf.code_block(
        "raw.historical_prices  (hypertable, 1-year chunks)\n"
        "  ticker, trade_date, open, high, low, close, adj_close, volume\n"
        "\n"
        "analytics.daily_signals\n"
        "  ticker, trade_date, close, sma_20, sma_50, sma_200, daily_return"
    )

    pdf.sub_title("Operations & Control Plane")
    pdf.code_block(
        "ops.data_catalog       — watermark state per ticker (CDC driver)\n"
        "ops.ingestion_log      — audit trail (run_id, status, rows, timing)\n"
        "ops.pipeline_metrics   — time-series for Grafana (hypertable, 1-day chunks)"
    )

    pdf.sub_title("Schema Migrations")
    pdf.body_text("8 version-controlled SQL files applied automatically on container startup:")
    migrations = [
        "000  create raw schema (historical_prices)",
        "001  create ops schema (data_catalog, ingestion_log)",
        "002  create analytics schema (daily_signals)",
        "003  enable TimescaleDB extension, convert to hypertables",
        "004  create bronze schema (market_ticks hypertable)",
        "005  create silver schema (ohlcv_1min hypertable)",
        "006  create gold views (continuous aggregates with refresh policies)",
        "007  create pipeline_metrics (hypertable for Grafana)",
    ]
    for m in migrations:
        pdf.bullet(m)

    # ─── 5. Pipeline Architecture ────────────────────────────
    pdf.add_page()
    pdf.section_title("5. Pipeline Architecture")

    pdf.sub_title("Real-Time Pipeline (During Market Hours)")
    pdf.code_block(
        "Upstox WebSocket (protobuf)\n"
        "    |\n"
        "    v\n"
        "upstox_ws.py  -- decode ticks, push to Redis Stream\n"
        "    |\n"
        "    v\n"
        "Redis Stream: market:ticks (capped at 500K entries)\n"
        "    |\n"
        "    v\n"
        "consumer.py  -- XREADGROUP (batch 200), executemany INSERT\n"
        "    |\n"
        "    v\n"
        "bronze.market_ticks (TimescaleDB hypertable)"
    )

    pdf.bullet("Market-aware: Only streams during NSE hours (9:00 - 15:40 IST)")
    pdf.bullet("Holiday-aware: NSE holiday calendar with 15+ holidays/year")
    pdf.bullet("Consumer group: at-least-once delivery with XACK after DB insert")
    pdf.bullet("Idempotent: ON CONFLICT DO NOTHING prevents duplicates on reprocessing")
    pdf.bullet("Batch inserts: executemany for throughput (not row-at-a-time)")

    pdf.ln(3)
    pdf.sub_title("EOD Pipeline (After Market Close)")
    pdf.body_text("Orchestrated by Prefect, runs daily ~16:00 IST:")
    pdf.code_block(
        "eod_pipeline (Prefect @flow)\n"
        "    |\n"
        "    +-- fetch_daily_candle      -- yfinance incremental via watermark\n"
        "    +-- upsert_raw_prices       -- INSERT into raw.historical_prices\n"
        "    +-- quality_gate            -- hard checks + soft checks\n"
        "    +-- compute_signals         -- SMA-20/50/200, daily returns\n"
        "    +-- aggregate_ticks_to_silver -- bronze ticks -> silver.ohlcv_1min\n"
        "    +-- update_watermark        -- ops.data_catalog high_watermark\n"
        "    +-- log_ingestion           -- ops.ingestion_log audit entry\n"
        "    +-- emit_metric             -- ops.pipeline_metrics for Grafana"
    )

    pdf.ln(3)
    pdf.sub_title("Data Quality Gate")
    pdf.sub_sub_title("Hard Checks (fail the pipeline)")
    pdf.bullet("OHLCV invariant: high >= low, high >= open, high >= close")
    pdf.bullet("Null/zero price detection")
    pdf.bullet("Volume non-negative")

    pdf.sub_sub_title("Soft Checks (log warnings)")
    pdf.bullet("Price outlier detection (>20% daily move)")
    pdf.bullet("Staleness check (gaps > 3 trading days)")

    pdf.ln(3)
    pdf.sub_title("Tracked Instruments")
    pdf.body_text(
        "Equities (10 NSE large-caps): RELIANCE, SBIN, ICICIBANK, HDFCBANK, TCS, "
        "ITC, BHARTIARTL, BAJFINANCE, HCLTECH, INFY"
    )
    pdf.body_text("Indices: NIFTY 50, BANK NIFTY")

    # ─── 6. API Endpoints ───────────────────────────────────
    pdf.add_page()
    pdf.section_title("6. API Endpoints")
    pdf.body_text("All endpoints served by the unified FastAPI backend on port 8000.")

    pdf.sub_title("Backtesting")
    w3 = [20, 65, 105]
    pdf.table_row(("Method", "Endpoint", "Description"), w3, bold=True, fill=True)
    pdf.table_row(("POST", "/api/backtest", "Run vectorized backtest (MA Crossover, RSI, MACD)"), w3)
    pdf.table_row(("POST", "/api/monte-carlo", "Run Monte Carlo simulation on backtest results"), w3)

    pdf.ln(3)
    pdf.sub_title("AI Strategy Verification")
    pdf.table_row(("Method", "Endpoint", "Description"), w3, bold=True, fill=True)
    pdf.table_row(("POST", "/api/verify-strategy", "Verify AI-generated trading strategies vs real data"), w3)

    pdf.ln(3)
    pdf.sub_title("Signals & Chart Data")
    pdf.table_row(("Method", "Endpoint", "Description"), w3, bold=True, fill=True)
    pdf.table_row(("GET", "/api/signals/unified/{ticker}", "OHLCV + SMA signals for chart widgets"), w3)

    pdf.ln(3)
    pdf.sub_title("Data Ingestion (Pipeline Control)")
    pdf.table_row(("Method", "Endpoint", "Description"), w3, bold=True, fill=True)
    pdf.table_row(("POST", "/api/ingest/eod", "Trigger EOD pipeline"), w3)
    pdf.table_row(("POST", "/api/ingest/backfill", "Trigger historical backfill from yfinance"), w3)
    pdf.table_row(("POST", "/api/ingest/quality-audit", "Trigger data quality audit"), w3)
    pdf.table_row(("GET", "/api/ingest/status/{flow_id}", "Check flow execution status"), w3)
    pdf.table_row(("GET", "/api/ingest/flows", "List recent triggered flows"), w3)
    pdf.table_row(("GET", "/api/ingest/history", "Ingestion audit log from ops.ingestion_log"), w3)

    pdf.ln(3)
    pdf.sub_title("Authentication (Upstox OAuth2)")
    pdf.table_row(("Method", "Endpoint", "Description"), w3, bold=True, fill=True)
    pdf.table_row(("GET", "/api/auth/login", "Redirect to Upstox OAuth consent page"), w3)
    pdf.table_row(("GET", "/api/auth/callback", "Handle OAuth callback, store token in Redis"), w3)
    pdf.table_row(("GET", "/api/auth/status", "Check authentication state"), w3)
    pdf.table_row(("POST", "/api/auth/token", "Manually inject an access token"), w3)

    pdf.ln(3)
    pdf.sub_title("Health")
    pdf.table_row(("Method", "Endpoint", "Description"), w3, bold=True, fill=True)
    pdf.table_row(("GET", "/api/health", "Database, Redis, and pipeline status check"), w3)

    # ─── 7. Backtesting Engine ────────────────────────────────
    pdf.add_page()
    pdf.section_title("7. Backtesting Engine")

    pdf.sub_title("Supported Strategies")
    w_strat = [50, 55, 85]
    pdf.table_row(("Strategy", "Signals", "Parameters"), w_strat, bold=True, fill=True)
    pdf.table_row(("MA Crossover", "Golden/death cross", "Short period, long period"), w_strat)
    pdf.table_row(("RSI", "Overbought/oversold", "RSI period, OB level, OS level"), w_strat)
    pdf.table_row(("MACD", "Signal line crossover", "Fast, slow, signal period"), w_strat)

    pdf.ln(4)
    pdf.sub_title("Features")
    pdf.bullet("Vectorized simulation over historical OHLCV data from TimescaleDB")
    pdf.bullet("Realistic Indian equity cost model: STT, stamp duty, GST, brokerage, SEBI turnover fee, exchange fees")
    pdf.bullet("Deterministic slippage model with seeded pseudo-RNG")
    pdf.bullet("Monte Carlo simulation for strategy robustness testing")
    pdf.bullet("Equity curve, trade log, and performance metrics")

    pdf.ln(2)
    pdf.sub_title("Performance Metrics")
    pdf.bullet("Sharpe Ratio (annualized, risk-free rate = 6.5%)")
    pdf.bullet("CAGR (Compound Annual Growth Rate)")
    pdf.bullet("Maximum Drawdown")
    pdf.bullet("Alpha (excess return over benchmark)")
    pdf.bullet("Information Ratio")
    pdf.bullet("Win Rate, total trades, P&L breakdown")

    pdf.ln(2)
    pdf.sub_title("AI Strategy Verifier (BS Detector)")
    pdf.body_text(
        "Takes user-submitted entry/exit code (e.g. from ChatGPT), validates it via AST analysis "
        "for safety, executes it in a sandboxed environment against real historical data from "
        "TimescaleDB, backtests the strategy, and compares actual results against the AI's claimed "
        "performance (win rate, return, drawdown). Produces a truth verdict: Verified, Plausible, "
        "Misleading, or BS."
    )

    # ─── 8. Grafana Dashboards ───────────────────────────────
    pdf.add_page()
    pdf.section_title("8. Observability (Grafana Dashboards)")
    pdf.body_text(
        "Four dashboards are auto-provisioned via YAML configuration files and JSON dashboard models. "
        "Grafana connects directly to TimescaleDB as its datasource and is configured for anonymous "
        "read access and iframe embedding (used in the React frontend's Pipeline tab)."
    )

    w_dash = [40, 25, 125]
    pdf.table_row(("Dashboard", "Panels", "Key Data Sources"), w_dash, bold=True, fill=True)
    pdf.table_row(("Pipeline Health", "9", "ops.ingestion_log, ops.pipeline_metrics"), w_dash)
    pdf.table_row(("Market Data", "9", "bronze.market_ticks, silver.ohlcv_1min, raw.historical_prices"), w_dash)
    pdf.table_row(("Data Quality", "8", "Gap detection via LEAD() window function, quality checks"), w_dash)
    pdf.table_row(("System Metrics", "10", "hypertable_size(), timescaledb_information.chunks"), w_dash)

    pdf.ln(4)
    pdf.sub_title("Dashboard Details")

    pdf.sub_sub_title("Pipeline Health")
    pdf.bullet("Stat panels: total runs, success rate, failure count, total rows ingested")
    pdf.bullet("Time series: ingestion runs over time, rows inserted over time")
    pdf.bullet("Tables: data freshness per ticker, recent ingestion log entries")

    pdf.sub_sub_title("Market Data")
    pdf.bullet("Template variables for instrument and ticker selection")
    pdf.bullet("Stat panels: ticks today, active instruments, silver bars, historical tickers")
    pdf.bullet("Time series: tick rate, live price, volume, daily closes")

    pdf.sub_sub_title("Data Quality")
    pdf.bullet("Stat panels: stale tickers, DQ failures, total rows analyzed")
    pdf.bullet("Tables: completeness by ticker, gap detection, recent failure log")
    pdf.bullet("Time series: failure trends, data volume growth")

    pdf.sub_sub_title("System Metrics")
    pdf.bullet("Stat panels: table sizes using hypertable_size()")
    pdf.bullet("Tables: chunk details, hypertable summary, database size overview")
    pdf.bullet("Time series: pipeline metrics, EOD rows per ticker")

    # ─── 9. Docker Compose ──────────────────────────────────
    pdf.add_page()
    pdf.section_title("9. Infrastructure (Docker Compose)")

    w_svc = [10, 32, 55, 14, 79]
    pdf.table_row(("#", "Service", "Image", "Port", "Purpose"), w_svc, bold=True, fill=True)
    pdf.table_row(("1", "timescaledb", "timescale/timescaledb:latest-pg16", "5432", "TimescaleDB warehouse"), w_svc)
    pdf.table_row(("2", "redis", "redis:7-alpine", "6379", "Tick stream broker"), w_svc)
    pdf.table_row(("3", "api", "python-engine (FastAPI)", "8000", "Unified REST API"), w_svc)
    pdf.table_row(("4", "pipeline-worker", "python-engine (consumer)", "--", "Redis -> TimescaleDB consumer"), w_svc)
    pdf.table_row(("5", "prefect-server", "prefecthq/prefect:3-latest", "4200", "Orchestration server + UI"), w_svc)
    pdf.table_row(("6", "grafana", "grafana/grafana:latest", "3000", "Observability dashboards"), w_svc)
    pdf.table_row(("7", "client", "React/Vite", "5173", "Frontend application"), w_svc)

    pdf.ln(4)
    pdf.body_text(
        "Total memory footprint: ~1.4GB RAM. All services include Docker health checks. "
        "Startup order is managed via depends_on with condition: service_healthy. "
        "Schema migrations (000-007) run automatically via the TimescaleDB container's "
        "docker-entrypoint-initdb.d volume mount."
    )

    pdf.sub_title("Environment Variables")
    pdf.code_block(
        "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/traderetro_raw\n"
        "REDIS_URL=redis://localhost:6379\n"
        "UPSTOX_CLIENT_ID=your_client_id_here\n"
        "UPSTOX_CLIENT_SECRET=your_client_secret_here\n"
        "UPSTOX_REDIRECT_URI=http://localhost:8000/api/auth/callback\n"
        "PREFECT_API_URL=http://localhost:4200/api\n"
        "PIPELINE_MODE=simulate  (simulate | live | consumer_only)\n"
        "HOST=0.0.0.0\n"
        "PORT=8000"
    )

    # ─── 10. Testing ────────────────────────────────────────
    pdf.add_page()
    pdf.section_title("10. Testing")

    pdf.body_text("73 tests across 5 test files, runnable locally without Docker infrastructure.")

    w_test = [40, 15, 135]
    pdf.table_row(("File", "Tests", "Coverage"), w_test, bold=True, fill=True)
    pdf.table_row(("test_simulation.py", "14", "Backtest engine: report structure, metric sanity, edge cases"), w_test)
    pdf.table_row(("test_costs.py", "12", "Indian cost model: STT, stamp duty, GST, brokerage, slippage"), w_test)
    pdf.table_row(("test_metrics.py", "15", "Financial metrics: Sharpe, drawdown, CAGR, alpha, IR"), w_test)
    pdf.table_row(("test_pipeline.py", "15", "Market hours, quality checks, flow structure, Prefect DAGs"), w_test)
    pdf.table_row(("test_routers.py", "10", "FastAPI endpoints: health, backtest, BS detector, ingestion"), w_test)

    pdf.ln(4)
    pdf.sub_title("Testing Strategy")
    pdf.bullet("Heavy dependencies (Redis, asyncpg, Prefect) are stubbed via sys.modules for local testing")
    pdf.bullet("Prefect-dependent tests auto-skip locally with @pytest.mark.skipif and pass in Docker")
    pdf.bullet("FastAPI TestClient with mocked lifespan (patched init_pool/init_redis) for endpoint tests")
    pdf.bullet("TestClient(raise_server_exceptions=False) for testing error response codes")

    pdf.ln(2)
    pdf.sub_title("Running Tests")
    pdf.code_block(
        "cd python-engine\n"
        "pip install -r requirements.txt\n"
        "python -m pytest tests/ -v"
    )

    # ─── 11. DE Concepts ────────────────────────────────────
    pdf.add_page()
    pdf.section_title("11. Data Engineering Concepts Demonstrated")

    concepts = [
        ("Concept", "Implementation"),
        ("Medallion Architecture", "Bronze (raw ticks) -> Silver (1min OHLCV) -> Gold (5min/daily aggregates)"),
        ("Real-Time Streaming ETL", "Upstox WebSocket -> Redis Streams -> Consumer -> TimescaleDB"),
        ("Consumer Groups", "Redis XREADGROUP with at-least-once delivery and XACK"),
        ("Batch Inserts", "executemany + ON CONFLICT DO NOTHING for idempotent throughput"),
        ("Watermark-Based CDC", "ops.data_catalog.high_watermark drives incremental loads"),
        ("Idempotent Upserts", "ON CONFLICT DO NOTHING / DO UPDATE prevents duplicates"),
        ("Data Quality Gates", "Hard checks (OHLCV invariants) + soft checks (outlier, staleness)"),
        ("DAG Orchestration", "Prefect flows: EOD pipeline, backfill, quality audit"),
        ("Continuous Aggregates", "TimescaleDB auto-refreshed materialized views"),
        ("Schema Migrations", "8 version-controlled SQL DDL files (000-007)"),
        ("Observability", "4 Grafana dashboards: health, data, quality, system"),
        ("Connection Pooling", "Shared asyncpg pool via FastAPI lifespan"),
        ("Token Persistence", "Upstox OAuth2 tokens stored in Redis, shared across containers"),
        ("Market-Aware Scheduling", "IST market hours, NSE holiday calendar"),
    ]
    w2 = [52, 138]
    for i, row in enumerate(concepts):
        pdf.table_row(row, w2, bold=(i == 0), fill=(i == 0))

    # ─── 12. Quick Start ──────────────────────────────────────
    pdf.add_page()
    pdf.section_title("12. Setup & Quick Start")

    pdf.sub_title("Prerequisites")
    pdf.bullet("Docker Desktop (with Docker Compose)")
    pdf.bullet("16GB RAM recommended")
    pdf.bullet("Upstox API credentials (optional, for live data)")

    pdf.ln(2)
    pdf.sub_title("Steps")
    pdf.sub_sub_title("1. Clone and Configure")
    pdf.code_block(
        "git clone https://github.com/Adhi-opp/TradeRetro.git\n"
        "cd TradeRetro\n"
        "cp .env.example .env\n"
        "# Edit .env with your Upstox credentials (optional)"
    )

    pdf.sub_sub_title("2. Start All Services")
    pdf.code_block("docker compose up -d")
    pdf.body_text("This starts all 7 containers. Migrations run automatically on first boot.")

    pdf.sub_sub_title("3. Verify")
    pdf.code_block(
        "curl http://localhost:8000/api/health"
    )

    pdf.sub_sub_title("4. Access UIs")
    w_ui = [55, 135]
    pdf.table_row(("UI", "URL"), w_ui, bold=True, fill=True)
    pdf.table_row(("React Frontend", "http://localhost:5173"), w_ui)
    pdf.table_row(("FastAPI Docs (Swagger)", "http://localhost:8000/docs"), w_ui)
    pdf.table_row(("Grafana Dashboards", "http://localhost:3000  (admin / traderetro)"), w_ui)
    pdf.table_row(("Prefect Orchestration", "http://localhost:4200"), w_ui)

    pdf.ln(4)
    pdf.sub_title("Connecting Upstox (Live Data)")
    pdf.bullet("1. Register at https://api.upstox.com/developer")
    pdf.bullet("2. Set UPSTOX_CLIENT_ID and UPSTOX_CLIENT_SECRET in .env")
    pdf.bullet("3. Start the stack: docker compose up -d")
    pdf.bullet("4. Visit http://localhost:8000/api/auth/login to authorize")
    pdf.bullet("5. Pipeline worker automatically starts streaming during market hours")

    # ─── Output ─────────────────────────────────────────────
    pdf.output("TradeRetro_Documentation.pdf")
    print("PDF generated: TradeRetro_Documentation.pdf")


if __name__ == "__main__":
    build_pdf()
