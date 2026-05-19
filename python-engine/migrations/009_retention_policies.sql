-- Retention policies — auto-drop old chunks to keep the warehouse trim.
-- TimescaleDB scheduler runs these in the background; nothing to wire up
-- in the application code.
--
-- bronze.market_ticks: raw ticks are useful for live aggregation and
--   recent debugging; older history lives in silver/gold rollups.
--   Drop chunks older than 30 days.
--
-- ops.pipeline_metrics: telemetry only, 90 days is plenty.

SELECT add_retention_policy(
    'bronze.market_ticks',
    INTERVAL '30 days',
    if_not_exists => true
);

SELECT add_retention_policy(
    'ops.pipeline_metrics',
    INTERVAL '90 days',
    if_not_exists => true
);
