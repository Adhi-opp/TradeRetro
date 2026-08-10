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

// A Sharpe of 0.002 rounds to "0.00" at two decimals and reads as missing
// data rather than as a near-zero result. Widen the precision only when the
// value would otherwise vanish.
export const ratio = (v) => {
  if (v == null || Number.isNaN(v)) return '—';
  if (v !== 0 && Math.abs(v) < 0.005) return v.toFixed(3);
  return v.toFixed(2);
};

export default function KpiRibbon({ metrics, applyCosts }) {
  if (!metrics) return null;

  // Excess CAGR, not alpha — a plain return spread with no beta adjustment.
  // Comes from the engine so gross and net views stay internally consistent.
  const excess = metrics.excessCagr;

  return (
    <div className="kpi-ribbon">
      <Kpi
        label="Total Return"
        value={signedPct(metrics.totalReturn)}
        tone={toneOf(metrics.totalReturn)}
        sub={applyCosts ? 'net of costs' : 'costs excluded'}
      />
      <Kpi label="CAGR" value={signedPct(metrics.cagr)} tone={toneOf(metrics.cagr)} />
      <Kpi
        label="Excess CAGR"
        value={signedPct(excess)}
        tone={toneOf(excess)}
        sub={`vs B&H ${signedPct(metrics.benchmarkCagr)}`}
      />
      <Kpi label="Max Drawdown" value={pct(metrics.maxDrawdown)} tone="neg" />
      <Kpi label="Sharpe" value={ratio(metrics.sharpeRatio)} tone={toneOf(metrics.sharpeRatio)} sub="rf 6.5%" />
      <Kpi label="Sortino" value={ratio(metrics.sortinoRatio)} tone={toneOf(metrics.sortinoRatio)} sub="rf 6.5%" />
      <Kpi label="Win Rate" value={pct(metrics.winRate, 0)} tone={metrics.winRate >= 50 ? 'pos' : 'neg'} sub={`${metrics.totalTrades} trades`} />
      <Kpi label="Exposure" value={pct(metrics.exposurePct, 0)} sub="time in market" />
    </div>
  );
}
