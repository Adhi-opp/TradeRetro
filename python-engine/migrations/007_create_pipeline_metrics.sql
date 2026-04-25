-- Pipeline metrics table for Grafana dashboards.
-- Time-series of pipeline health indicators.

CREATE TABLE IF NOT EXISTS ops.pipeline_metrics (
    metric_name   VARCHAR(100)  NOT NULL,
    metric_value  NUMERIC       NOT NULL,
    labels        JSONB         DEFAULT '{}',
    recorded_at   TIMESTAMPTZ   DEFAULT NOW()
);

SELECT create_hypertable(
    'ops.pipeline_metrics',
    'recorded_at',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => true
);

CREATE INDEX IF NOT EXISTS idx_metrics_name
    ON ops.pipeline_metrics (metric_name, recorded_at DESC);
