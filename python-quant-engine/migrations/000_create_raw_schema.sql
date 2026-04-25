-- Raw (Bronze) layer: landing zone for external data sources.
-- All data arrives here before any transformation.

CREATE SCHEMA IF NOT EXISTS raw;

CREATE TABLE IF NOT EXISTS raw.historical_prices (
    ticker        VARCHAR(20)  NOT NULL,
    trade_date    DATE         NOT NULL,
    open_price    NUMERIC      NOT NULL,
    high_price    NUMERIC      NOT NULL,
    low_price     NUMERIC      NOT NULL,
    close_price   NUMERIC      NOT NULL,
    volume        BIGINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (ticker, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_hp_ticker ON raw.historical_prices(ticker);
