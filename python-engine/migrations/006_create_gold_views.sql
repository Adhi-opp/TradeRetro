-- Gold layer: continuous aggregates (materialized views) over silver data.
-- TimescaleDB auto-refreshes these on new data.

CREATE SCHEMA IF NOT EXISTS gold;

-- 5-minute rollup from 1-minute bars
CREATE MATERIALIZED VIEW IF NOT EXISTS gold.ohlcv_5min
WITH (timescaledb.continuous) AS
SELECT
    instrument_key,
    time_bucket('5 minutes', bucket) AS bucket_5m,
    first(open, bucket)  AS open,
    max(high)            AS high,
    min(low)             AS low,
    last(close, bucket)  AS close,
    sum(volume)          AS volume
FROM silver.ohlcv_1min
GROUP BY instrument_key, bucket_5m
WITH NO DATA;

-- Daily rollup from 1-minute bars
CREATE MATERIALIZED VIEW IF NOT EXISTS gold.ohlcv_daily
WITH (timescaledb.continuous) AS
SELECT
    instrument_key,
    time_bucket('1 day', bucket) AS trade_date,
    first(open, bucket)  AS open,
    max(high)            AS high,
    min(low)             AS low,
    last(close, bucket)  AS close,
    sum(volume)          AS volume
FROM silver.ohlcv_1min
GROUP BY instrument_key, trade_date
WITH NO DATA;

-- Auto-refresh policies (refresh last 2 hours of data every 5 minutes)
SELECT add_continuous_aggregate_policy('gold.ohlcv_5min',
    start_offset    => INTERVAL '2 hours',
    end_offset      => INTERVAL '1 minute',
    schedule_interval => INTERVAL '5 minutes',
    if_not_exists   => true
);

SELECT add_continuous_aggregate_policy('gold.ohlcv_daily',
    start_offset    => INTERVAL '3 days',
    end_offset      => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists   => true
);
