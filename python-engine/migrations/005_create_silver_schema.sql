-- Silver layer: cleaned, aggregated 1-minute OHLCV bars from bronze ticks.
-- Populated by the pipeline consumer worker.

CREATE SCHEMA IF NOT EXISTS silver;

CREATE TABLE IF NOT EXISTS silver.ohlcv_1min (
    instrument_key  VARCHAR(50)   NOT NULL,
    bucket          TIMESTAMPTZ   NOT NULL,
    open            NUMERIC       NOT NULL,
    high            NUMERIC       NOT NULL,
    low             NUMERIC       NOT NULL,
    close           NUMERIC       NOT NULL,
    volume          BIGINT        DEFAULT 0,
    trade_count     INT           DEFAULT 0,
    quality_score   SMALLINT      DEFAULT 100,
    PRIMARY KEY (instrument_key, bucket)
);

SELECT create_hypertable(
    'silver.ohlcv_1min',
    'bucket',
    chunk_time_interval => INTERVAL '1 week',
    if_not_exists => true
);
