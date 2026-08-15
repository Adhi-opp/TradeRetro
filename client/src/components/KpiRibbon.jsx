import {
  TrendingUp, TrendingDown, Trophy, ShieldAlert, Activity,
  Percent, LineChart, Scale, Gauge, Clock,
} from 'lucide-react';

// `icon` and `badge` are optional. A KPI states a measured number; it does not
// grade it. The graded variants ("EXCELLENT", "LOW RISK") were dropped because
// their thresholds compared a negative drawdown against a positive bound, so
// every run — including a -46% drawdown — rendered as low risk.
function Kpi({ icon: Icon, label, value, tone, sub, trend, badge }) {
  const isPos = tone === 'pos';
  return (
    <div className="kpi">
      <div className="kpi-top">
        {Icon && (
          <span className="kpi-icon-wrapper">
            <Icon size={16} />
          </span>
        )}
        {badge && <span className="kpi-badge">{badge}</span>}
      </div>
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        <div className={`kpi-value ${tone || ''}`}>{value}</div>
      </div>
      <div className="kpi-footer">
        {trend && (
          <span className={`kpi-trend ${tone || ''}`}>
            {isPos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend}
          </span>
        )}
        {sub && <span className="kpi-sub">{sub}</span>}
      </div>
    </div>
  );
}

const pct = (v, dp = 1) => (v == null ? '—' : `${v.toFixed(dp)}%`);
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
  // (The beta-adjusted figure is Jensen's alpha, reported in RiskMetricsGrid.)
  const excess = metrics.excessCagr;

  return (
    <div className="kpi-ribbon">
      <Kpi
        icon={Trophy}
        label="Total Return"
        value={signedPct(metrics.totalReturn)}
        tone={toneOf(metrics.totalReturn)}
        sub={applyCosts ? 'net of costs' : 'costs excluded'}
      />
      <Kpi icon={LineChart} label="CAGR" value={signedPct(metrics.cagr)} tone={toneOf(metrics.cagr)} />
      <Kpi
        icon={Scale}
        label="Excess CAGR"
        value={signedPct(excess)}
        tone={toneOf(excess)}
        sub={`vs B&H ${signedPct(metrics.benchmarkCagr)}`}
      />
      <Kpi icon={ShieldAlert} label="Max Drawdown" value={pct(metrics.maxDrawdown)} tone="neg" sub="peak to trough" />
      <Kpi icon={Activity} label="Sharpe" value={ratio(metrics.sharpeRatio)} tone={toneOf(metrics.sharpeRatio)} sub="rf 6.5%" />
      <Kpi icon={Gauge} label="Sortino" value={ratio(metrics.sortinoRatio)} tone={toneOf(metrics.sortinoRatio)} sub="rf 6.5%" />
      <Kpi icon={Percent} label="Win Rate" value={pct(metrics.winRate, 0)} tone={metrics.winRate >= 50 ? 'pos' : 'neg'} sub={`${metrics.totalTrades} trades`} />
      <Kpi icon={Clock} label="Exposure" value={pct(metrics.exposurePct, 0)} sub="time in market" />
    </div>
  );
}
