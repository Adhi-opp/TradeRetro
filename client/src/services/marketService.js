import { GET } from './apiClient';

/**
 * Fetches unified price, signal, and overlay data for a ticker.
 *
 * Matches the existing FastAPI contract:
 * GET /api/signals/unified/{ticker}
 *
 * @param {string} ticker
 * @param {Record<string, unknown>} [query]
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getUnifiedSignals(ticker, query, options) {
  return GET(`/api/signals/unified/${encodeURIComponent(ticker)}`, { ...options, query });
}

/**
 * Fetches live quotes.
 *
 * Matches the existing FastAPI contract:
 * GET /api/live/quotes
 *
 * @param {Record<string, unknown>} [query]
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getLiveQuotes(query, options) {
  return GET('/api/live/quotes', { ...options, query });
}

/**
 * Fetches VIX data.
 *
 * Matches the existing FastAPI contract:
 * GET /api/live/vix
 *
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getLiveVix(options) {
  return GET('/api/live/vix', options);
}

/**
 * Fetches live strategy signals.
 *
 * Matches the existing FastAPI contract:
 * GET /api/live/signals
 *
 * @param {Record<string, unknown>} [query]
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getLiveSignals(query, options) {
  return GET('/api/live/signals', { ...options, query });
}

/**
 * Fetches historical/live price series for a symbol.
 *
 * Matches the existing FastAPI contract:
 * GET /api/live/prices/{symbol}
 *
 * @param {string} symbol
 * @param {Record<string, unknown>} [query]
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getLivePrices(symbol, query, options) {
  return GET(`/api/live/prices/${encodeURIComponent(symbol)}`, { ...options, query });
}

/**
 * Fetches the cross-asset correlation matrix.
 *
 * Matches the existing FastAPI contract:
 * GET /api/correlation/matrix
 *
 * @param {Record<string, unknown>} [query]
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getCorrelationMatrix(query, options) {
  return GET('/api/correlation/matrix', { ...options, query });
}

/**
 * Fetches rolling correlation data.
 *
 * Matches the existing FastAPI contract:
 * GET /api/correlation/rolling
 *
 * @param {Record<string, unknown>} [query]
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getRollingCorrelation(query, options) {
  return GET('/api/correlation/rolling', { ...options, query });
}

/**
 * Fetches lead-lag correlation data.
 *
 * Matches the existing FastAPI contract:
 * GET /api/correlation/leadlag
 *
 * @param {Record<string, unknown>} [query]
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getLeadLag(query, options) {
  return GET('/api/correlation/leadlag', { ...options, query });
}

/**
 * Fetches divergence data.
 *
 * Matches the existing FastAPI contract:
 * GET /api/correlation/divergence
 *
 * @param {Record<string, unknown>} [query]
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>}
 */
export function getDivergence(query, options) {
  return GET('/api/correlation/divergence', { ...options, query });
}
