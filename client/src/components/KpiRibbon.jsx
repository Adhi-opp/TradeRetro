// Top KPI strip for the tearsheet. Pure presentation — metrics/analytics are
// computed once in TearsheetGrid and passed down.

function Kpi({ label, value, tone, sub }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone || ''}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

const pct = (v, dp = 1) => (v == null ? '—' : `${v >= 0 ? '' : ''}${v.toFixed(dp)}%`);
const signedPct = (v, dp = 2) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(dp)}%`);
const toneOf = (v) => (v == null ? '' : v >= 0 ? 'pos' : 'neg');

export default function KpiRibbon({ metrics, analytics }) {
  if (!metrics) return null;

  const alpha = (metrics.totalReturn ?? 0) - (metrics.buyHoldReturn ?? 0);

  return (
    <div className="kpi-ribbon">
      <Kpi label="Total Return" value={signedPct(metrics.totalReturn)} tone={toneOf(metrics.totalReturn)} />
      <Kpi label="CAGR" value={signedPct(metrics.cagr)} tone={toneOf(metrics.cagr)} />
      <Kpi label="Alpha vs B&H" value={signedPct(alpha)} tone={toneOf(alpha)} sub={`B&H ${signedPct(metrics.buyHoldReturn)}`} />
      <Kpi label="Max Drawdown" value={pct(metrics.maxDrawdown)} tone="neg" />
      <Kpi label="Sharpe" value={metrics.sharpeRatio?.toFixed(2) ?? '—'} tone={toneOf(metrics.sharpeRatio)} />
      <Kpi label="Sortino" value={analytics?.sortino?.toFixed(2) ?? '—'} tone={toneOf(analytics?.sortino)} />
      <Kpi label="Win Rate" value={pct(metrics.winRate, 0)} tone={metrics.winRate >= 50 ? 'pos' : 'neg'} sub={`${metrics.totalTrades} trades`} />
      <Kpi label="Exposure" value={pct(metrics.exposurePct, 0)} sub="time in market" />
    </div>
  );
}
