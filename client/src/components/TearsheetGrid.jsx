import { useMemo, useState } from 'react';
import { Terminal, ChevronDown, ChevronRight } from 'lucide-react';
import useBacktestStore from '../store/useBacktestStore';
import { analyze } from '../utils/performance';
import KpiRibbon from './KpiRibbon';
import EquityChart from './EquityChart';
import ExecutionSummary from './ExecutionSummary';
import DrawdownChart from './DrawdownChart';
import TradeLog from './TradeLog';
import ErrorBoundary from './ErrorBoundary';
import ChartWidget from './ChartWidget';
import RiskMetricsGrid from './RiskMetricsGrid';
import MonthlyHeatmap from './MonthlyHeatmap';
import ReturnDistribution from './ReturnDistribution';
import ParameterSweep from './ParameterSweep';
import WalkForward from './WalkForward';

function LoadingState() {
  return (
    <div className="tearsheet-loading">
      <div className="skeleton-ribbon" />
      <div className="ts-skeleton-row">
        <div className="skeleton-chart" style={{ flex: 7 }} />
        <div className="skeleton-chart" style={{ flex: 3 }} />
      </div>
    </div>
  );
}

function IdleState({ error }) {
  return (
    <div className="tearsheet-idle">
      <Terminal size={42} />
      {error ? (
        <>
          <p className="idle-title" style={{ color: 'var(--red)' }}>{error}</p>
          <p className="idle-desc">Check the configuration above and run again.</p>
        </>
      ) : (
        <>
          <p className="idle-title">Awaiting Strategy Execution</p>
          <p className="idle-desc">Configure a strategy above and hit <strong>Run Backtest</strong>.</p>
        </>
      )}
    </div>
  );
}

export default function TearsheetGrid({ theme }) {
  const result = useBacktestStore((s) => s.result);
  const loading = useBacktestStore((s) => s.loading);
  const error = useBacktestStore((s) => s.error);
  const applyCosts = useBacktestStore((s) => s.applyCosts);
  const ranTicker = useBacktestStore((s) => s.ranTicker);
  const ranRange = useBacktestStore((s) => s.ranRange);
  const ranStrategyParams = useBacktestStore((s) => s.ranStrategyParams);

  const [showDeep, setShowDeep] = useState(false);

  const hasResult = !loading && result && result.metrics;

  const analytics = useMemo(
    () => (hasResult ? analyze(result, applyCosts) : null),
    [result, applyCosts, hasResult],
  );

  const metrics = useMemo(() => {
    if (!hasResult) return null;
    return applyCosts ? result.metrics : { ...result.metrics, ...(result.grossMetrics || {}) };
  }, [result, applyCosts, hasResult]);

  if (loading) return <div className="tearsheet"><LoadingState /></div>;
  if (!hasResult) return <div className="tearsheet"><IdleState error={error} /></div>;

  return (
    <div className="tearsheet">
      <KpiRibbon metrics={metrics} analytics={analytics} />

      {/* Row 1 — 70 / 30 : equity curve | execution stats */}
      <div className="ts-row ts-row-7030">
        <div className="ts-cell ts-cell-70">
          <ErrorBoundary fallbackTitle="Equity Chart Failed" fallbackMessage="Equity curve data malformed.">
            {result.equityCurve && <EquityChart data={result.equityCurve} showCosts={applyCosts} />}
          </ErrorBoundary>
        </div>
        <div className="ts-cell ts-cell-30">
          <ExecutionSummary
            metrics={metrics}
            analytics={analytics}
            trades={result.trades}
            costBreakdown={result.costBreakdown}
            applyCosts={applyCosts}
          />
        </div>
      </div>

      {/* Row 2 — 50 / 50 : drawdown | trade log */}
      <div className="ts-row ts-row-5050">
        <div className="ts-cell ts-cell-50">
          {analytics?.drawdown && <DrawdownChart data={analytics.drawdown} />}
        </div>
        <div className="ts-cell ts-cell-50">
          <ErrorBoundary fallbackTitle="Trade Log Failed" fallbackMessage="Trade data could not be rendered.">
            <TradeLog trades={result.trades} applyCosts={applyCosts} />
          </ErrorBoundary>
        </div>
      </div>

      {/* Deep analytics — collapsed by default to keep the command center clean */}
      <button className="ts-deep-toggle" onClick={() => setShowDeep((v) => !v)}>
        {showDeep ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        Deep Analytics — price chart, monthly returns, distribution, parameter sweep
      </button>

      {showDeep && (
        <div className="ts-deep">
          <ErrorBoundary fallbackTitle="Price Chart Failed" fallbackMessage="Could not render the price chart.">
            <ChartWidget
              theme={theme}
              ticker={ranTicker}
              backtestTicker={ranTicker}
              trades={result.trades || []}
              strategyParams={ranStrategyParams}
              dateRange={ranRange}
              equityCurve={result.equityCurve || null}
              showCosts={applyCosts}
            />
          </ErrorBoundary>

          <RiskMetricsGrid metrics={metrics} analytics={analytics} applyCosts={applyCosts} />

          <div className="ts-row ts-row-5050">
            <div className="ts-cell ts-cell-50">{analytics?.monthly && <MonthlyHeatmap data={analytics.monthly} />}</div>
            <div className="ts-cell ts-cell-50">{analytics?.histogram && <ReturnDistribution data={analytics.histogram} />}</div>
          </div>

          <ErrorBoundary fallbackTitle="Sweep Failed" fallbackMessage="Could not render parameter sweep.">
            <ParameterSweep
              ticker={ranTicker}
              strategyType={ranStrategyParams?.strategyType}
              baseParams={{
                initialCapital: metrics?.initialCapital || 100000,
                shortPeriod: ranStrategyParams?.fastSma,
                longPeriod: ranStrategyParams?.slowSma,
                rsiPeriod: ranStrategyParams?.rsiPeriod,
                oversold: ranStrategyParams?.oversold,
                overbought: ranStrategyParams?.overbought,
              }}
              dateRange={ranRange}
            />
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Walk-Forward Failed" fallbackMessage="Could not render walk-forward analysis.">
            <WalkForward />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}
