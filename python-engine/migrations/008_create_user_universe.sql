-- User Ticker Universe
-- Stores the set of tickers the user has added to the system, with
-- backfill state so the UI can surface progress. Tickers outside this
-- table are still queryable, but the frontend uses it to populate
-- autocomplete suggestions and the cross-asset universe.

CREATE TABLE IF NOT EXISTS ops.user_universe (
    symbol          VARCHAR(32) PRIMARY KEY,
    display_name    VARCHAR(128),
    asset_class     VARCHAR(16) DEFAULT 'equity',
    added_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_backfill_at TIMESTAMPTZ,
    backfill_status VARCHAR(16) DEFAULT 'pending',
    backfill_job_id VARCHAR(64),
    row_count       INT DEFAULT 0,
    earliest_date   DATE,
    latest_date     DATE
);

CREATE INDEX IF NOT EXISTS idx_user_universe_added_at
    ON ops.user_universe(added_at DESC);

-- Seed the default demo universe so existing backfilled tickers show up
INSERT INTO ops.user_universe (symbol, display_name, asset_class, backfill_status)
VALUES
    ('NIFTY50.NS',     'NIFTY 50',           'index',    'completed'),
    ('BANKNIFTY.NS',   'Bank Nifty',         'index',    'completed'),
    ('RELIANCE.NS',    'Reliance Industries','equity',   'completed'),
    ('HDFCBANK.NS',    'HDFC Bank',          'equity',   'completed'),
    ('ICICIBANK.NS',   'ICICI Bank',         'equity',   'completed'),
    ('SBIN.NS',        'State Bank of India','equity',   'completed'),
    ('TCS.NS',         'Tata Consultancy',   'equity',   'completed'),
    ('INFY.NS',        'Infosys',            'equity',   'completed'),
    ('HCLTECH.NS',     'HCL Technologies',   'equity',   'completed'),
    ('ITC.NS',         'ITC',                'equity',   'completed'),
    ('BHARTIARTL.NS',  'Bharti Airtel',      'equity',   'completed'),
    ('BAJFINANCE.NS',  'Bajaj Finance',      'equity',   'completed'),
    ('USDINR',         'USD / INR',          'forex',    'completed'),
    ('CRUDE',          'Crude Oil',          'commodity','completed'),
    ('INDIAVIX',       'India VIX',          'vol',      'pending')
ON CONFLICT (symbol) DO NOTHING;
