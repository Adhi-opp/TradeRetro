import { POST } from './apiClient';

/**
 * Runs a standard strategy backtest.
 *
 * Matches the existing FastAPI contract:
 * POST /api/backtest
 *
 * @param {object} payload Existing backtest request payload.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>} Existing backtest response payload.
 */
export function runBacktest(payload, options) {
  return POST('/api/backtest', payload, options);
}

/**
 * Runs a parameter sweep for strategy robustness analysis.
 *
 * Matches the existing FastAPI contract:
 * POST /api/backtest/sweep
 *
 * @param {object} payload Existing sweep request payload.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>} Existing sweep response payload.
 */
export function runParameterSweep(payload, options) {
  return POST('/api/backtest/sweep', payload, options);
}

/**
 * Runs walk-forward analysis.
 *
 * Matches the existing FastAPI contract:
 * POST /api/backtest/wfa
 *
 * @param {object} payload Existing walk-forward request payload.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object>} Existing walk-forward response payload.
 */
export function runWalkForwardAnalysis(payload, options) {
  return POST('/api/backtest/wfa', payload, options);
}
