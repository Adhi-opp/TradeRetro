import { DELETE, GET, POST } from './apiClient';

/**
 * Fetches backend health status.
 *
 * Matches the existing FastAPI contract:
 * GET /api/health
 *
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getHealth(options) {
  return GET('/api/health', options);
}

/**
 * Fetches pipeline health status.
 *
 * Matches the existing FastAPI contract:
 * GET /api/health/pipeline
 *
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getPipelineHealth(options) {
  return GET('/api/health/pipeline', options);
}

/**
 * Fetches data quality audit results.
 *
 * Matches the existing FastAPI contract:
 * GET /api/quality/audit
 *
 * @param {Record<string, unknown>} [query]
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getQualityAudit(query, options) {
  return GET('/api/quality/audit', { ...options, query });
}

/**
 * Fetches quality audit details for one ticker.
 *
 * Matches the existing FastAPI contract:
 * GET /api/quality/audit/{ticker}
 *
 * @param {string} ticker
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getTickerQualityAudit(ticker, options) {
  return GET(`/api/quality/audit/${encodeURIComponent(ticker)}`, options);
}

/**
 * Fetches the stored user universe.
 *
 * Matches the existing FastAPI contract:
 * GET /api/universe
 *
 * @param {Record<string, unknown>} [query]
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getUniverse(query, options) {
  return GET('/api/universe', { ...options, query });
}

/**
 * Resolves a ticker symbol.
 *
 * Matches the existing FastAPI contract:
 * GET /api/universe/resolve
 *
 * @param {Record<string, unknown>} query
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function resolveTicker(query, options) {
  return GET('/api/universe/resolve', { ...options, query });
}

/**
 * Adds a symbol to the universe and may trigger backfill.
 *
 * Matches the existing FastAPI contract:
 * POST /api/universe
 *
 * @param {object} payload Existing universe request payload.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function addUniverseSymbol(payload, options) {
  return POST('/api/universe', payload, options);
}

/**
 * Removes a symbol from the universe.
 *
 * Matches the existing FastAPI contract:
 * DELETE /api/universe/{symbol}
 *
 * @param {string} symbol
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function removeUniverseSymbol(symbol, options) {
  return DELETE(`/api/universe/${encodeURIComponent(symbol)}`, options);
}

/**
 * Triggers the EOD ingestion flow.
 *
 * Matches the existing FastAPI contract:
 * POST /api/ingest/eod
 *
 * @param {object} [payload]
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function triggerEodIngestion(payload = {}, options) {
  return POST('/api/ingest/eod', payload, options);
}

/**
 * Triggers historical backfill.
 *
 * Matches the existing FastAPI contract:
 * POST /api/ingest/backfill
 *
 * @param {object} payload Existing backfill request payload.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function triggerBackfill(payload, options) {
  return POST('/api/ingest/backfill', payload, options);
}

/**
 * Triggers a quality-audit ingestion flow.
 *
 * Matches the existing FastAPI contract:
 * POST /api/ingest/quality-audit
 *
 * @param {object} [payload]
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function triggerQualityAudit(payload = {}, options) {
  return POST('/api/ingest/quality-audit', payload, options);
}

/**
 * Fetches ingestion flow status.
 *
 * Matches the existing FastAPI contract:
 * GET /api/ingest/status/{flowId}
 *
 * @param {string} flowId
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getIngestionStatus(flowId, options) {
  return GET(`/api/ingest/status/${encodeURIComponent(flowId)}`, options);
}

/**
 * Fetches known ingestion flows.
 *
 * Matches the existing FastAPI contract:
 * GET /api/ingest/flows
 *
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getIngestionFlows(options) {
  return GET('/api/ingest/flows', options);
}

/**
 * Fetches ingestion history.
 *
 * Matches the existing FastAPI contract:
 * GET /api/ingest/history
 *
 * @param {Record<string, unknown>} [query]
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getIngestionHistory(query, options) {
  return GET('/api/ingest/history', { ...options, query });
}

/**
 * Fetches reconciliation gaps.
 *
 * Matches the existing FastAPI contract:
 * GET /api/reconcile/gaps
 *
 * @param {Record<string, unknown>} [query]
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getReconcileGaps(query, options) {
  return GET('/api/reconcile/gaps', { ...options, query });
}

/**
 * Runs reconciliation.
 *
 * Matches the existing FastAPI contract:
 * POST /api/reconcile
 *
 * @param {object} payload Existing reconciliation request payload.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function runReconciliation(payload, options) {
  return POST('/api/reconcile', payload, options);
}
