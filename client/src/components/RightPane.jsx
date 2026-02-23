import { Terminal } from 'lucide-react';
import MetricsCard from './MetricsCard';
import EquityChart from './EquityChart';
import TradeTable from './TradeTable';
import VerdictCard from './VerdictCard';
import ErrorBoundary from './ErrorBoundary';

function CostBreakdown({ costs }) {
  if (!costs) return null;

  const items = [
    { label: 'STT', value: costs.stt },
    { label: 'Brokerage', value: costs.brokerage },
    { label: 'Slippage', value: costs.slippage },
    { label: 'Exchange Fees', value: costs.exchangeFees },
    { label: 'GST', value: costs.gst },
    { label: 'Stamp Duty', value: costs.stampDuty },
  ];

  return (
    <div className="panel cost-breakdown-panel">
      <div className="panel-title">Indian Transaction Costs</div>
      <div className="cost-breakdown-grid">
        {items.map((item) => (
          <div key={item.label} className="cost-item">
            <span className="cost-item-label">{item.label}</span>
            <span className="cost-item-value">
              ₹{item.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
        <div className="cost-item cost-item-total">
          <span className="cost-item-label">Total Costs</span>
          <span className="cost-item-value">
            ₹{costs.totalCosts.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="cost-item cost-item-total">
          <span className="cost-item-label">% of Capital</span>
          <span className="cost-item-value">{costs.costPctOfCapital.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}

function SimulationMeta({ meta }) {
  if (!meta) return null;

  return (
    <div className="panel sim-meta-panel">
      <div className="panel-title">Simulation Metadata</div>
      <div className="sim-meta-grid">
        <span className="sim-meta-item">Data: {meta.dataSource}</span>
        <span className="sim-meta-item">Regime: {meta.regimeModel}</span>
        <span className="sim-meta-item">Costs: {meta.transactionCostModel}</span>
        {meta.seed != null && <span className="sim-meta-item">Seed: {meta.seed}</span>}
      </div>
    </div>
  );
}

function MonteCarloResults({ data }) {
  if (!data || !data.distribution) return null;

  const d = data.distribution;
  const barData = data.runs
    .map((r) => r.totalReturn)
    .sort((a, b) => a - b);

  // Build histogram buckets
  const bucketCount = 10;
  const min = barData[0];
  const max = barData[barData.length - 1];
  const bucketSize = (max - min) / bucketCount || 1;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    range: `${(min + i * bucketSize).toFixed(0)}%`,
    count: 0,
  }));
  barData.forEach((v) => {
    const idx = Math.min(Math.floor((v - min) / bucketSize), bucketCount - 1);
    buckets[idx].count++;
  });
  const maxCount = Math.max(...buckets.map((b) => b.count));

  return (
    <div className="results-container">
      <div className="panel monte-carlo-panel">
        <div className="panel-title">Monte Carlo Distribution ({d.totalRuns} runs)</div>

        <div className="mc-stats-grid">
          <div className="mc-stat">
            <span className="mc-stat-label">Mean Return</span>
            <span className={'mc-stat-value ' + (d.mean >= 0 ? 'positive' : 'negative')}>{d.mean.toFixed(2)}%</span>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-label">Median</span>
            <span className="mc-stat-value">{d.median.toFixed(2)}%</span>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-label">Std Dev</span>
            <span className="mc-stat-value">{d.stdDev.toFixed(2)}%</span>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-label">Best Case</span>
            <span className="mc-stat-value positive">{d.max.toFixed(2)}%</span>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-label">Worst Case</span>
            <span className="mc-stat-value negative">{d.min.toFixed(2)}%</span>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-label">Win Rate</span>
            <span className="mc-stat-value">{Math.round((d.positiveRuns / d.totalRuns) * 100)}%</span>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-label">5th Pctl</span>
            <span className="mc-stat-value negative">{d.percentile5.toFixed(2)}%</span>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-label">95th Pctl</span>
            <span className="mc-stat-value positive">{d.percentile95.toFixed(2)}%</span>
          </div>
        </div>

        {/* Simple histogram */}
        <div className="mc-histogram">
          <div className="mc-histogram-label">Return Distribution</div>
          <div className="mc-histogram-bars">
            {buckets.map((b, i) => (
              <div key={i} className="mc-bar-col">
                <div
                  className="mc-bar"
                  style={{ height: `${maxCount > 0 ? (b.count / maxCount) * 100 : 0}%` }}
                />
                <span className="mc-bar-label">{b.range}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel sim-meta-panel">
        <div className="panel-title">Execution Info</div>
        <div className="sim-meta-grid">
          <span className="sim-meta-item">Runs: {d.totalRuns}</span>
          <span className="sim-meta-item">Time: {data.executionTimeMs}ms</span>
        </div>
      </div>
    </div>
  );
}

export default function RightPane({ mode, result, verdictResult, monteCarloResult, loading, applyCosts }) {
  const isManual = mode === 'manual';
  const hasManualResults = isManual && !loading && result && result.metrics;
  const hasVerdictResults = !isManual && !loading && verdictResult;
  const hasMonteCarloResults = isManual && !loading && monteCarloResult;
  const isIdle = !loading && !hasManualResults && !hasVerdictResults && !hasMonteCarloResults;

  return (
    <div className="right-pane">
      <div className="right-pane-header">
        <span className="right-pane-label">Output Monitor</span>
        {loading && <span className="right-pane-status pulse-dot">Processing...</span>}
      </div>

      <div className="right-pane-scroll">
        {/* Loading */}
        {loading && (
          <div className="right-pane-loading">
            <div className="skeleton-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-card" />
              ))}
            </div>
            <div className="skeleton-chart" />
          </div>
        )}

        {/* Idle / Awaiting */}
        {isIdle && (
          <div className="right-pane-idle">
            <Terminal size={40} />
            <p className="idle-title">Awaiting Strategy Execution...</p>
            <p className="idle-desc">
              {isManual
                ? 'Configure a strategy in the control panel and hit Run Backtest.'
                : 'Paste an AI strategy, enter claimed metrics, and hit Verify.'}
            </p>
          </div>
        )}

        {/* Manual Results */}
        {hasManualResults && (() => {
          const m = applyCosts ? result.metrics : (result.grossMetrics || result.metrics);
          return (
          <div className="results-container">
            {/* Primary Metrics */}
            <div className="metrics-grid">
              <MetricsCard label="Total Return" value={m.totalReturn} format="percent" />
              <MetricsCard label="Buy & Hold" value={result.metrics.buyHoldReturn} format="percent" />
              <MetricsCard label="Max Drawdown" value={m.maxDrawdown} format="percent" />
              <MetricsCard label="Sharpe Ratio" value={result.metrics.sharpeRatio} format="number" />
              <MetricsCard label="Win Rate" value={m.winRate} format="percent" />
              <MetricsCard label={applyCosts ? 'Net Profit' : 'Gross Profit'} value={m.totalReturnRupee} format="currency" />
            </div>

            {/* Benchmark Comparison */}
            {m.cagr !== undefined && (
              <div className="metrics-grid metrics-grid-benchmark">
                <MetricsCard label="Strategy CAGR" value={m.cagr} format="percent" />
                <MetricsCard label="Benchmark CAGR" value={result.metrics.benchmarkCagr} format="percent" />
                <MetricsCard label="Alpha" value={m.alpha} format="percent" />
                <MetricsCard label="Info Ratio" value={result.metrics.informationRatio} format="number" />
              </div>
            )}

            {/* No-trade warning */}
            {result.metrics.totalTrades === 0 && (
              <div className="panel no-trade-warning">
                <div className="panel-title">No Trades Executed</div>
                <p>The strategy never triggered a buy signal during the selected period. Try adjusting your parameters or expanding the date range.</p>
              </div>
            )}

            {/* Cost Breakdown — only when costs toggle is on */}
            {applyCosts && result.costBreakdown && <CostBreakdown costs={result.costBreakdown} />}

            <ErrorBoundary fallbackTitle="Chart Rendering Failed" fallbackMessage="The equity curve data may be malformed. Try a different configuration.">
              {result.equityCurve && <EquityChart data={result.equityCurve} showCosts={applyCosts} />}
            </ErrorBoundary>
            <ErrorBoundary fallbackTitle="Trade Table Failed" fallbackMessage="Trade data could not be rendered.">
              {result.trades && result.trades.length > 0 && <TradeTable trades={result.trades} applyCosts={applyCosts} />}
            </ErrorBoundary>

            {/* Simulation Metadata */}
            {result.simulationMeta && <SimulationMeta meta={result.simulationMeta} />}
          </div>
          );
        })()}

        {/* Monte Carlo Results */}
        {hasMonteCarloResults && (
          <ErrorBoundary fallbackTitle="Monte Carlo Rendering Failed" fallbackMessage="Could not display distribution.">
            <MonteCarloResults data={monteCarloResult} />
          </ErrorBoundary>
        )}

        {/* AI Verdict */}
        {hasVerdictResults && (
          <ErrorBoundary fallbackTitle="Verdict Rendering Failed" fallbackMessage="The verification response could not be displayed.">
            <VerdictCard data={verdictResult} />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
