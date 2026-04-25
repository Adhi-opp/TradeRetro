-- 1. Create the Control Plane Schema
CREATE SCHEMA IF NOT EXISTS ops;

-- 2. Create the Watermark Catalog (State Tracker)
CREATE TABLE IF NOT EXISTS ops.data_catalog (
    ticker VARCHAR(20) PRIMARY KEY,
    first_trade_date DATE,
    high_watermark DATE,
    last_refreshed TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create the Ingestion Log (Audit Trail)
CREATE TABLE IF NOT EXISTS ops.ingestion_log (
    run_id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) NOT NULL,
    load_type VARCHAR(20) CHECK (load_type IN ('full', 'incremental')),
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ,
    rows_fetched INT DEFAULT 0,
    rows_inserted INT DEFAULT 0,
    status VARCHAR(20) CHECK (status IN ('running', 'success', 'failed')),
    error_message TEXT
);

-- 4. Add an index to the log for fast dashboard queries
CREATE INDEX idx_ingestion_log_ticker ON ops.ingestion_log(ticker);
CREATE INDEX idx_ingestion_log_started_at ON ops.ingestion_log(started_at DESC);