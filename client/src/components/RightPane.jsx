import { Terminal, BarChart3, ShieldAlert } from 'lucide-react';
import MetricsCard from './MetricsCard';
import EquityChart from './EquityChart';
import TradeTable from './TradeTable';
import VerdictCard from './VerdictCard';

export default function RightPane({ mode, result, verdictResult, loading }) {
  const isManual = mode === 'manual';
  const hasManualResults = isManual && !loading && result && result.metrics;
  const hasVerdictResults = !isManual && !loading && verdictResult;
  const isIdle = !loading && !hasManualResults && !hasVerdictResults;

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
        {hasManualResults && (
          <div className="results-container">
            <div className="metrics-grid">
              <MetricsCard label="Total Return" value={result.metrics.totalReturn} format="percent" />
              <MetricsCard label="Buy & Hold" value={result.metrics.buyHoldReturn} format="percent" />
              <MetricsCard label="Max Drawdown" value={result.metrics.maxDrawdown} format="percent" />
              <MetricsCard label="Sharpe Ratio" value={result.metrics.sharpeRatio} format="number" />
              <MetricsCard label="Win Rate" value={result.metrics.winRate} format="percent" />
              <MetricsCard label="Net Profit" value={result.metrics.totalReturnDollar} format="currency" />
            </div>
            {result.equityCurve && <EquityChart data={result.equityCurve} />}
            {result.trades && <TradeTable trades={result.trades} />}
          </div>
        )}

        {/* AI Verdict */}
        {hasVerdictResults && <VerdictCard data={verdictResult} />}
      </div>
    </div>
  );
}
