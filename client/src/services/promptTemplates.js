/**
 * AI Prompt Templates
 * ====================
 * Pure module — no React, no JSX, no network calls.
 *
 * Single source of truth for quick-action prompts and example prompts.
 * Quick action builders consume a backtest store snapshot (the same shape
 * as useBacktestStore state) and fall back to a generic prompt whenever
 * the relevant context is unavailable.
 */

const STRATEGY_LABELS = {
  MOVING_AVERAGE_CROSSOVER: 'Moving Average Crossover',
  RSI: 'RSI Mean Reversion',
  MACD: 'MACD',
  BOLLINGER_BREAKOUT: 'Bollinger Breakout',
  DONCHIAN_BREAKOUT: 'Donchian Breakout',
};

const STRATEGY_PARAM_TEXT = {
  MOVING_AVERAGE_CROSSOVER: (s) => `fast SMA ${s.fastSma}, slow SMA ${s.slowSma}`,
  RSI: (s) => `RSI period ${s.rsiPeriod}, oversold ${s.oversold}, overbought ${s.overbought}`,
  MACD: () => '',
  BOLLINGER_BREAKOUT: (s) => `period ${s.bbPeriod}, std dev ${s.bbStdDev}`,
  DONCHIAN_BREAKOUT: (s) => `period ${s.dcPeriod}`,
};

const PERCENT_METRICS = new Set([
  'totalReturn',
  'totalReturnRupee',
  'maxDrawdown',
  'cagr',
  'winRate',
  'avgProfitLoss',
  'exposurePct',
  'buyHoldReturn',
  'benchmarkCagr',
  'alpha',
  'riskPct',
]);

const METRIC_LABELS = [
  ['totalReturn', 'total return'],
  ['sharpeRatio', 'Sharpe ratio'],
  ['maxDrawdown', 'max drawdown'],
  ['winRate', 'win rate'],
  ['cagr', 'CAGR'],
  ['totalTrades', 'trades'],
  ['finalValue', 'final value'],
];

// ── Formatting helpers ──────────────────────────────────────────────────

function formatNumber(value) {
  if (typeof value !== 'number') return value;
  return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

function describeStrategy(backtest) {
  if (!backtest?.strategyType) return '';
  const label = STRATEGY_LABELS[backtest.strategyType] || backtest.strategyType;
  const params = STRATEGY_PARAM_TEXT[backtest.strategyType]?.(backtest) || '';
  return params ? `${label} (${params})` : label;
}

function describeMarket(backtest) {
  if (!backtest?.ticker) return '';
  const range =
    backtest.startDate && backtest.endDate
      ? ` from ${backtest.startDate} to ${backtest.endDate}`
      : '';
  return `${backtest.ticker}${range}`;
}

function describeMetrics(backtest) {
  const metrics = backtest?.result?.metrics;
  if (!metrics) return '';
  const parts = METRIC_LABELS.filter(([key]) => metrics[key] !== undefined && metrics[key] !== null)
    .map(([key, label]) => {
      const value = formatNumber(metrics[key]);
      const unit = PERCENT_METRICS.has(key) ? '%' : '';
      return `${label} ${value}${unit}`;
    });
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Quick action builders
// ---------------------------------------------------------------------------

function buildExplainStrategyPrompt(backtest) {
  const strategy = describeStrategy(backtest);
  if (!strategy) {
    return 'Explain the strategy I have configured — how it works, what each parameter controls, and how signals are generated.';
  }
  const market = describeMarket(backtest);
  return `Explain the ${strategy} strategy${market ? ` for ${market}` : ''} in plain English — how signals are generated, what each parameter controls, and when it typically performs well or poorly.`;
}

function buildExplainMetricsPrompt(backtest) {
  const metrics = describeMetrics(backtest);
  if (!metrics) {
    return 'Explain the standard backtest metrics I should look at — what each one measures and how to interpret them together.';
  }
  return `Explain the metrics from my latest backtest (${metrics}): what each one means, what it says about the strategy, and which matter most.`;
}

function buildImproveStrategyPrompt(backtest) {
  const strategy = describeStrategy(backtest);
  const market = describeMarket(backtest);
  const metrics = describeMetrics(backtest);
  if (!strategy) {
    return 'Suggest realistic improvements to my current strategy — parameter tweaks, entry or exit filters, and risk controls — and explain the trade-offs of each.';
  }
  const context = [strategy, market && `traded on ${market}`, metrics && `latest results: ${metrics}`]
    .filter(Boolean)
    .join('; ');
  return `Suggest specific improvements for the ${context}. Focus on parameter tweaks, entry or exit filters, and risk controls, and explain the trade-offs of each change.`;
}

function buildBacktestSummaryPrompt(backtest) {
  const strategy = describeStrategy(backtest);
  const market = describeMarket(backtest);
  const metrics = describeMetrics(backtest);
  const strategyPart = strategy ? `the ${strategy} strategy` : 'the current strategy';
  const marketPart = market ? ` on ${market}` : '';
  const metricsPart = metrics ? ` Key metrics: ${metrics}.` : '';
  return `Summarize the latest backtest of ${strategyPart}${marketPart} — what was tested, how it performed, strengths, weaknesses, and the most important takeaway.${metricsPart}`;
}

const QUICK_ACTION_BUILDERS = {
  EXPLAIN_STRATEGY: buildExplainStrategyPrompt,
  EXPLAIN_METRICS: buildExplainMetricsPrompt,
  IMPROVE_STRATEGY: buildImproveStrategyPrompt,
  BACKTEST_SUMMARY: buildBacktestSummaryPrompt,
};

export const QUICK_ACTIONS = [
  {
    id: 'EXPLAIN_STRATEGY',
    label: 'Explain Strategy',
    description: 'Get a plain-English breakdown of any strategy',
    buildPrompt: QUICK_ACTION_BUILDERS.EXPLAIN_STRATEGY,
  },
  {
    id: 'EXPLAIN_METRICS',
    label: 'Explain Metrics',
    description: 'Understand what each metric means',
    buildPrompt: QUICK_ACTION_BUILDERS.EXPLAIN_METRICS,
  },
  {
    id: 'IMPROVE_STRATEGY',
    label: 'Improve Strategy',
    description: 'Suggest optimizations for your strategy',
    buildPrompt: QUICK_ACTION_BUILDERS.IMPROVE_STRATEGY,
  },
  {
    id: 'BACKTEST_SUMMARY',
    label: 'Generate Backtest Summary',
    description: 'Summarize the latest backtest results',
    buildPrompt: QUICK_ACTION_BUILDERS.BACKTEST_SUMMARY,
  },
];

export const EXAMPLE_PROMPTS = [
  'Why did this strategy lose money?',
  'Explain Sharpe Ratio',
  'Improve this EMA crossover strategy',
  'When should I avoid mean reversion strategies?',
];

/**
 * Build the prompt for a quick action from the current app state.
 *
 * @param {object} action - A QUICK_ACTIONS entry.
 * @param {object} backtest - Snapshot of useBacktestStore state.
 * @returns {string} Context-aware prompt, or a generic fallback.
 */
export function buildQuickActionPrompt(action, backtest) {
  const builder = action?.buildPrompt;
  if (typeof builder !== 'function') return '';
  const prompt = builder(backtest || {});
  return (prompt || '').trim();
}