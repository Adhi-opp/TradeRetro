/**
 * AI Context Builder
 * ===================
 * Pure module — no React, no JSX, no UI, no network calls.
 *
 * Builds a normalized AI context payload from application state.
 * Only includes sections with actual data. Never sends empty objects.
 * Designed to be extended by adding builder functions to the registry.
 */

const DEV = import.meta.env?.DEV === true;

// ── Domain builders (extensible registry) ──────────────────────────────

function buildStrategyData(backtest) {
  if (!backtest) return null;

  const strategy = {
    strategy_type: backtest.strategyType,
  };

  const params = {};

  if (backtest.capital) {
    params.initial_capital = backtest.capital;
  }

  switch (backtest.strategyType) {
    case 'MOVING_AVERAGE_CROSSOVER':
      params.fast_sma = backtest.fastSma;
      params.slow_sma = backtest.slowSma;
      break;
    case 'RSI':
      params.rsi_period = backtest.rsiPeriod;
      params.oversold = backtest.oversold;
      params.overbought = backtest.overbought;
      break;
    case 'BOLLINGER_BREAKOUT':
      params.bb_period = backtest.bbPeriod;
      params.bb_std_dev = backtest.bbStdDev;
      break;
    case 'DONCHIAN_BREAKOUT':
      params.dc_period = backtest.dcPeriod;
      break;
    default:
      break;
  }

  if (Object.keys(params).length > 0) {
    strategy.parameters = params;
  }

  if (backtest.riskEnabled) {
    strategy.risk = {
      enabled: true,
      risk_per_trade_pct: backtest.riskPct,
      stop_loss_pct: backtest.stopLossPct,
    };
  }

  return strategy;
}

function buildMarketData(backtest) {
  if (!backtest) return null;

  const market = {};

  if (backtest.ticker) market.symbol = backtest.ticker;
  if (backtest.startDate) market.start_date = backtest.startDate;
  if (backtest.endDate) market.end_date = backtest.endDate;

  return Object.keys(market).length > 0 ? market : null;
}

function buildBacktestData(result) {
  if (!result) return null;

  const bt = {};

  if (result.metrics) {
    if (result.metrics.startDate) bt.start_date = result.metrics.startDate;
    if (result.metrics.endDate) bt.end_date = result.metrics.endDate;
    if (result.metrics.totalDays !== undefined) bt.total_days = result.metrics.totalDays;
    if (result.metrics.totalTrades !== undefined) bt.total_trades = result.metrics.totalTrades;
  }

  if (result.equityCurve && Array.isArray(result.equityCurve)) {
    bt.equity_curve_points = result.equityCurve.length;
  }

  if (result.trades && Array.isArray(result.trades)) {
    bt.trade_count = result.trades.length;
  }

  return Object.keys(bt).length > 0 ? bt : null;
}

function buildMetricsData(result) {
  if (!result?.metrics) return null;

  const m = result.metrics;
  const metrics = {};

  if (m.initialCapital !== undefined) metrics.initial_capital = m.initialCapital;
  if (m.finalValue !== undefined) metrics.final_value = m.finalValue;
  if (m.totalReturn !== undefined) metrics.total_return_pct = m.totalReturn;
  if (m.totalReturnRupee !== undefined) metrics.total_return_rupee = m.totalReturnRupee;
  if (m.sharpeRatio !== undefined) metrics.sharpe_ratio = m.sharpeRatio;
  if (m.maxDrawdown !== undefined) metrics.max_drawdown_pct = m.maxDrawdown;
  if (m.cagr !== undefined) metrics.cagr_pct = m.cagr;
  if (m.winRate !== undefined) metrics.win_rate_pct = m.winRate;
  if (m.totalTrades !== undefined) metrics.total_trades = m.totalTrades;
  if (m.winningTrades !== undefined) metrics.winning_trades = m.winningTrades;
  if (m.losingTrades !== undefined) metrics.losing_trades = m.losingTrades;
  if (m.avgProfitLoss !== undefined) metrics.avg_profit_loss = m.avgProfitLoss;
  if (m.avgHoldingPeriod !== undefined) metrics.avg_holding_period = m.avgHoldingPeriod;
  if (m.exposurePct !== undefined) metrics.exposure_pct = m.exposurePct;
  if (m.buyHoldReturn !== undefined) metrics.buy_hold_return_pct = m.buyHoldReturn;
  if (m.benchmarkCagr !== undefined) metrics.benchmark_cagr_pct = m.benchmarkCagr;
  if (m.alpha !== undefined) metrics.alpha = m.alpha;
  if (m.informationRatio !== undefined) metrics.information_ratio = m.informationRatio;

  return Object.keys(metrics).length > 0 ? metrics : null;
}

// ── Builder registry (extend by adding entries here) ──────────────────

const BUILDERS = [
  { key: 'strategy_data', build: (state) => buildStrategyData(state.backtest) },
  { key: 'market_data', build: (state) => buildMarketData(state.backtest) },
  {
    key: 'backtest_data',
    build: (state) => (state.backtest?.result ? buildBacktestData(state.backtest.result) : null),
  },
  {
    key: 'metrics_data',
    build: (state) => (state.backtest?.result ? buildMetricsData(state.backtest.result) : null),
  },
];

// ── Public API ────────────────────────────────────────────────────────

/**
 * Build a normalized AI context payload from application state.
 *
 * @param {object} state - Snapshot of relevant Zustand stores.
 * @param {object} [state.backtest] - useBacktestStore state.
 * @returns {object} Payload with only populated context sections.
 */
export function buildAiContext(state) {
  const payload = {};

  for (const { key, build } of BUILDERS) {
    const data = build(state);
    if (data !== null && data !== undefined && Object.keys(data).length > 0) {
      payload[key] = data;
    }
  }

  if (DEV) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload)).length;
    console.log('[AI Context]', JSON.stringify(payload, null, 2));
    console.log(`[AI Context] Payload size: ${bytes} bytes`);
    console.log(`[AI Context] Sections included: ${Object.keys(payload).join(', ') || '(none)'}`);
  }

  return payload;
}
