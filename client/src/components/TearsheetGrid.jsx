import { useCallback, useEffect, useMemo, useState } from 'react';
import { Terminal, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Trophy, ShieldAlert, Activity, Percent, Newspaper, Compass, AlertTriangle, Radio } from 'lucide-react';
import useBacktestStore from '../store/useBacktestStore';
import { getLiveQuotes } from '../services/marketService';
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

const MARKET_SYMBOLS = ['NIFTY50.NS', 'INDIAVIX', 'BANKNIFTY.NS'];

const MARKET_CARD_META = {
  'NIFTY50.NS': { label: 'NIFTY 50', Icon: Trophy },
  'INDIAVIX': { label: 'INDIA VIX', Icon: ShieldAlert },
  'BANKNIFTY.NS': { label: 'BANK NIFTY', Icon: Activity },
};

// Source labels mirror what /api/live/quotes reports per quote.
const SOURCE_LABELS = {
  simulator: 'Simulated feed',
  upstox: 'Live feed',
  live: 'Live feed',
  eod: 'EOD',
};

const SOURCE_COLORS = {
  simulator: '#f0c040',
  upstox: '#10B981',
  live: '#10B981',
  eod: '#4a9eda',
};

const sourceLabel = (source) => SOURCE_LABELS[source] || 'Source unavailable';
const sourceColor = (source) => SOURCE_COLORS[source] || '#71717A';

const fmtPrice = (v) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const skeletonBar = { height: '100%', background: 'linear-gradient(90deg, #1a1a1a 0%, #232323 50%, #1a1a1a 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', borderRadius: 6 };

function LiveMarketCards() {
  const [quotes, setQuotes] = useState([]);
  const [feedState, setFeedState] = useState('loading'); // loading | ready | error
  const [feedError, setFeedError] = useState('');

  const fetchQuotes = useCallback(async () => {
    try {
      const data = await getLiveQuotes({ symbols: MARKET_SYMBOLS });
      setQuotes(Array.isArray(data?.quotes) ? data.quotes : []);
      setFeedState('ready');
      setFeedError('');
    } catch (err) {
      setQuotes([]);
      setFeedState('error');
      setFeedError(err?.message || 'Live quote feed unavailable');
    }
  }, []);

  // Poll every 15s — same cadence as the Cross-Asset Monitor ticker strip.
  useEffect(() => {
    const first = setTimeout(fetchQuotes, 0);
    const id = setInterval(fetchQuotes, 15000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [fetchQuotes]);

  const quoteBySymbol = useMemo(() => {
    const map = {};
    quotes.forEach((q) => {
      if (q?.symbol) map[q.symbol] = q;
    });
    return map;
  }, [quotes]);

  const anySimulated = quotes.some((q) => q?.source === 'simulator');

  const liveCard = (sym) => {
    const meta = MARKET_CARD_META[sym];
    const q = quoteBySymbol[sym] || null;
    const hasData = !!q && q.last != null && q.change_pct != null;
    const up = hasData && Number(q.change_pct) >= 0;
    const rawSource = q ? q.source : null;
    const badge = sourceLabel(rawSource);
    const badgeColor = sourceColor(rawSource);
    const absChange = hasData && q.prev_close != null ? Number(q.last) - Number(q.prev_close) : null;
    const trend = absChange != null
      ? `${absChange >= 0 ? '+' : ''}${fmtPrice(absChange)}`
      : '—';
    const pct = hasData
      ? `(${Number(q.change_pct) >= 0 ? '+' : ''}${Number(q.change_pct).toFixed(2)}%)`
      : '—';
    return (
      <div className="kpi" key={sym}>
        <div className="kpi-top">
          <span className="kpi-icon-wrapper"><meta.Icon size={16} /></span>
          <span
            className="kpi-badge"
            title={q ? `source: ${rawSource}` : 'no quote reported'}
            style={{ color: badgeColor, background: `${badgeColor}14`, border: `1px solid ${badgeColor}33` }}
          >
            {badge}
          </span>
        </div>
        <div className="kpi-body">
          <div className="kpi-label">{meta.label}</div>
          <div className={`kpi-value ${hasData ? (up ? 'pos' : 'neg') : ''}`}>
            {hasData ? fmtPrice(q.last) : '—'}
          </div>
        </div>
        <div className="kpi-footer">
          <span className={`kpi-trend ${hasData ? (up ? 'pos' : 'neg') : ''}`}>
            {hasData ? (up ? <TrendingUp size={12} /> : <TrendingDown size={12} />) : null} {trend}
          </span>
          <span className="kpi-sub">{pct}</span>
        </div>
      </div>
    );
  };

  const skeletonCard = (sym) => {
    const meta = MARKET_CARD_META[sym];
    return (
      <div className="kpi" key={sym}>
        <div className="kpi-top">
          <span className="kpi-icon-wrapper"><meta.Icon size={16} /></span>
          <span className="kpi-badge" style={{ opacity: 0.5 }}>LOADING</span>
        </div>
        <div className="kpi-body">
          <div className="kpi-label">{meta.label}</div>
          <div className="kpi-value" aria-hidden="true" style={{ height: 14 }}>
            <div style={skeletonBar} />
          </div>
        </div>
        <div className="kpi-footer" aria-hidden="true" style={{ height: 12 }}>
          <div style={{ flex: 1, ...skeletonBar }} />
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="kpi-ribbon idle-market-ribbon">
        {feedState === 'loading'
          ? MARKET_SYMBOLS.map(skeletonCard)
          : MARKET_SYMBOLS.map(liveCard)}

        {/* NIFTY IT is not covered by the /api/live/quotes feed — report it explicitly instead of guessing. */}
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-icon-wrapper"><Percent size={16} /></span>
            <span className="kpi-badge" style={{ color: '#71717A', background: '#71717A14', border: '1px solid #71717A33' }}>
              Source unavailable
            </span>
          </div>
          <div className="kpi-body">
            <div className="kpi-label">NIFTY IT</div>
            <div className="kpi-value" style={{ color: '#71717A', fontSize: 20 }}>Not reported</div>
          </div>
          <div className="kpi-footer">
            <span className="kpi-trend">—</span>
            <span className="kpi-sub">—</span>
          </div>
        </div>
      </div>

      {feedState === 'error' && (
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 12, color: 'var(--red)', background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}>
          <AlertTriangle size={14} />
          <span>Market feed unavailable · start the Python API on :8000, then refresh. ({feedError})</span>
        </div>
      )}

      {feedState === 'ready' && anySimulated && (
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 11, color: '#f0c040', background: 'rgba(240,192,64,0.07)', borderColor: 'rgba(240,192,64,0.25)' }}>
          <Radio size={12} />
          <span>Simulated feed — synthetic ticks generated by the pipeline simulator, anchored to warehouse EOD data.</span>
        </div>
      )}
    </>
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
      <LiveMarketCards />

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
