-- Bronze layer: raw ticks from Upstox WebSocket (live market data).
-- Ingested via Redis Streams consumer.

CREATE SCHEMA IF NOT EXISTS bronze;

CREATE TABLE IF NOT EXISTS bronze.market_ticks (
    instrument_key  VARCHAR(50)    NOT NULL,
    timestamp       TIMESTAMPTZ    NOT NULL,
    ltp             NUMERIC        NOT NULL,
    volume          BIGINT         DEFAULT 0,
    oi              BIGINT         DEFAULT 0,
    bid_price       NUMERIC,
    ask_price       NUMERIC,
    bid_qty         BIGINT,
    ask_qty         BIGINT,
    ingested_at     TIMESTAMPTZ    DEFAULT NOW()
);

SELECT create_hypertable(
    'bronze.market_ticks',
    'timestamp',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => true
);

CREATE INDEX IF NOT EXISTS idx_ticks_instrument
    ON bronze.market_ticks (instrument_key, timestamp DESC);
