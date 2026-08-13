import { useMemo, useState } from 'react';
import { Terminal, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Trophy, ShieldAlert, Activity, Percent, Newspaper, Compass, AlertTriangle } from 'lucide-react';
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
    <div className="terminal-idle-dashboard">
      {/* 1. Market Overview Label */}
      <div className="section-label-bar">
        <h3>Market Overview</h3>
      </div>

      {/* 2. Live Market Cards */}
      <div className="kpi-ribbon idle-market-ribbon">
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-icon-wrapper"><Trophy size={16} /></span>
            <span className="kpi-badge">BULLISH</span>
          </div>
          <div className="kpi-body">
            <div className="kpi-label">NIFTY 50</div>
            <div className="kpi-value pos">24,320.50</div>
          </div>
          <div className="kpi-footer">
            <span className="kpi-trend pos"><TrendingUp size={12} /> +120.40</span>
            <span className="kpi-sub">(+0.50%)</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-icon-wrapper"><ShieldAlert size={16} /></span>
            <span className="kpi-badge">LOW VOL</span>
          </div>
          <div className="kpi-body">
            <div className="kpi-label">INDIA VIX</div>
            <div className="kpi-value neg">12.45</div>
          </div>
          <div className="kpi-footer">
            <span className="kpi-trend neg"><TrendingDown size={12} /> -0.35</span>
            <span className="kpi-sub">(-2.73%)</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-icon-wrapper"><Activity size={16} /></span>
            <span className="kpi-badge">STABLE</span>
          </div>
          <div className="kpi-body">
            <div className="kpi-label">BANK NIFTY</div>
            <div className="kpi-value pos">52,450.20</div>
          </div>
          <div className="kpi-footer">
            <span className="kpi-trend pos"><TrendingUp size={12} /> +450.80</span>
            <span className="kpi-sub">(+0.87%)</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-icon-wrapper"><Percent size={16} /></span>
            <span className="kpi-badge">VOLATILE</span>
          </div>
          <div className="kpi-body">
            <div className="kpi-label">NIFTY IT</div>
            <div className="kpi-value neg">39,120.10</div>
          </div>
          <div className="kpi-footer">
            <span className="kpi-trend neg"><TrendingDown size={12} /> -150.30</span>
            <span className="kpi-sub">(-0.38%)</span>
          </div>
        </div>
      </div>

      {/* 3. Central Backtest Console (Empty State Placement) */}
      <div className="panel idle-terminal-console">
        <div className="console-icon">
          {error ? <AlertTriangle size={32} color="var(--red)" /> : <Activity size={32} color="var(--primary)" />}
        </div>
        {error ? (
          <div className="console-text">
            <h4 style={{ color: 'var(--red)' }}>Backtest Error Encountered</h4>
            <p>{error}. Please adjust the parameter thresholds or time frames above and click Execute Backtest to retry.</p>
          </div>
        ) : (
          <div className="console-text">
            <h4>Awaiting Strategy Execution</h4>
            <p>Configure parameters on the builder panel above and click <strong>Execute Backtest</strong>. Historical returns, drawdown metrics, and trades will populate here.</p>
          </div>
        )}
      </div>

      {/* 4. Macro Feed & Cross Asset Insights */}
      <div className="ts-row ts-row-5050 idle-bottom-row">
        {/* Macro Feed */}
        <div className="ts-cell ts-cell-50 panel">
          <div className="panel-title-row">
            <span className="panel-title-icon"><Newspaper size={14} /></span>
            <span className="panel-title">Macro Feed</span>
          </div>
          <div className="macro-news-list">
            <div className="macro-news-item">
              <span className="news-time">10:15 IST</span>
              <span className="news-content">US CPI inflation eases to 3.0%, bolstering expectation for rate cuts.</span>
            </div>
            <div className="macro-news-item">
              <span className="news-time">09:45 IST</span>
              <span className="news-content">NSE cash volumes increase by 14% as midcaps regain momentum.</span>
            </div>
            <div className="macro-news-item">
              <span className="news-time">09:00 IST</span>
              <span className="news-content">Crude oil prices hover near $82 per barrel amid global geopolitical signals.</span>
            </div>
          </div>
        </div>

        {/* Cross Asset Insights */}
        <div className="ts-cell ts-cell-50 panel">
          <div className="panel-title-row">
            <span className="panel-title-icon"><Compass size={14} /></span>
            <span className="panel-title">Cross Asset Insights</span>
          </div>
          <div className="cross-asset-list">
            <div className="ca-insight-row">
              <span className="ca-label">USDINR Correlation</span>
              <span className="ca-value neg">-0.65</span>
            </div>
            <div className="ca-insight-row">
              <span className="ca-label">Gold vs Equities</span>
              <span className="ca-value pos">+0.12</span>
            </div>
            <div className="ca-insight-row">
              <span className="ca-label">Nifty 50 vs S&P 500</span>
              <span className="ca-value pos">+0.78</span>
            </div>
          </div>
        </div>
      </div>
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
