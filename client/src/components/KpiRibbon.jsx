import { TrendingUp, TrendingDown, Trophy, ShieldAlert, Activity, Percent } from 'lucide-react';

function Kpi({ icon: Icon, label, value, tone, sub, trend, badge }) {
  const isPos = tone === 'pos';
  const isNeg = tone === 'neg';
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-icon-wrapper">
          <Icon size={16} />
        </span>
        <span className="kpi-badge">{badge || 'ACTIVE'}</span>
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

export default function KpiRibbon({ metrics, analytics }) {
  if (!metrics) return null;

  const alpha = (metrics.totalReturn ?? 0) - (metrics.buyHoldReturn ?? 0);
  const totalTrades = metrics.totalTrades ?? 0;
  const winRate = metrics.winRate ?? 0;

  return (
    <div className="kpi-ribbon">
      <Kpi 
        icon={Trophy} 
        label="Net Profit" 
        value={signedPct(metrics.totalReturn)} 
        tone={toneOf(metrics.totalReturn)} 
        sub={`${signedPct(alpha)} alpha`} 
        trend={metrics.totalReturn >= 0 ? "Up" : "Down"} 
        badge={metrics.totalReturn >= 20 ? "EXCELLENT" : "STABLE"} 
      />
      <Kpi 
        icon={ShieldAlert} 
        label="Max Drawdown" 
        value={pct(metrics.maxDrawdown)} 
        tone="neg" 
        sub="Peak to trough" 
        trend="Risk" 
        badge={metrics.maxDrawdown <= 15 ? "LOW RISK" : "CRITICAL"} 
      />
      <Kpi 
        icon={Activity} 
        label="Sharpe Ratio" 
        value={metrics.sharpeRatio?.toFixed(2) ?? '-'} 
        tone={toneOf(metrics.sharpeRatio)} 
        sub="Risk-adjusted return" 
        trend={metrics.sharpeRatio >= 1.5 ? "Efficient" : "Moderate"} 
        badge={metrics.sharpeRatio >= 2 ? "HIGH ALPHA" : "NORMAL"} 
      />
      <Kpi 
        icon={Percent} 
        label="Win Ratio" 
        value={pct(winRate, 1)} 
        tone={winRate >= 50 ? 'pos' : 'neg'} 
        sub={`${totalTrades} trades executed`} 
        trend={winRate >= 50 ? "Outperforming" : "Underperforming"} 
        badge={winRate >= 60 ? "PRECISE" : "VOLATILE"} 
      />
    </div>
  );
}
