-- Analytics (Gold) layer: computed indicators derived from raw OHLCV.
-- Populated by compute_and_store_signals() after each ingestion.

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.daily_signals (
    ticker            VARCHAR(20),
    trade_date        DATE,
    close_price       NUMERIC,
    sma_20            NUMERIC,
    sma_50            NUMERIC,
    sma_200           NUMERIC,
    daily_return_pct  NUMERIC,
    PRIMARY KEY (ticker, trade_date)
);
