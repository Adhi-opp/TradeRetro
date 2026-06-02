-- Row-level provenance for silver bars.
--   'stream'      → aggregated from live bronze ticks (the normal path)
--   'reconciled'  → backfilled from the Upstox intraday REST API by the
--                   self-healing reconciliation flow, because the WebSocket
--                   had dropped and bronze was missing those ticks.
--
-- Lets the UI / quality audits show how much of a session was recovered vs
-- streamed, and lets reconciliation avoid clobbering real stream bars.

ALTER TABLE silver.ohlcv_1min
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'stream';
