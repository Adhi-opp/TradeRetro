-- Enable TimescaleDB extension and convert existing tables to hypertables.
-- This is a drop-in upgrade from plain PostgreSQL.

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert raw.historical_prices to a hypertable.
-- PK is (ticker, trade_date), and trade_date is the partitioning column.
SELECT create_hypertable(
    'raw.historical_prices',
    'trade_date',
    chunk_time_interval => INTERVAL '1 year',
    migrate_data => true,
    if_not_exists => true
);

-- Convert analytics.daily_signals to a hypertable.
SELECT create_hypertable(
    'analytics.daily_signals',
    'trade_date',
    chunk_time_interval => INTERVAL '1 year',
    migrate_data => true,
    if_not_exists => true
);
