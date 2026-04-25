import {
  Activity, Gauge, Zap, AlertTriangle, Timer, Target, TrendingDown, Percent,
} from 'lucide-react';

function Tile({ icon: Icon, label, value, tone = 'neutral', hint }) {
  return (
    <div className={`risk-tile risk-tile-${tone}`}>
      <div className="risk-tile-head">
        <Icon size={13} />
        <span>{label}</span>
      </div>
      <div className="risk-tile-value">{value}</div>
      {hint && <div className="risk-tile-hint">{hint}</div>}
    </div>
  );
}

function toneFor(v, good = (x) => x > 0) {
  if (v == null || Number.isNaN(v)) return 'neutral';
  return good(v) ? 'positive' : 'negative';
}

export default function RiskMetricsGrid({ metrics, analytics, applyCosts }) {
  if (!metrics) return null;
  const tradeCount = metrics.totalTrades;

  return (
    <div className="risk-grid">
      <Tile
        icon={Activity}
        label="Sharpe Ratio"
        value={metrics.sharpeRatio?.toFixed(2) ?? '\u2014'}
        tone={toneFor(metrics.sharpeRatio, (x) => x >= 1)}
        hint="annualized, rf=0"
      />
      <Tile
        icon={Target}
        label="Sortino"
        value={analytics?.sortino?.toFixed(2) ?? '\u2014'}
        tone={toneFor(analytics?.sortino, (x) => x >= 1)}
        hint="downside-only vol"
      />
      <Tile
        icon={Gauge}
        label="Calmar"
        value={analytics?.calmar?.toFixed(2) ?? '\u2014'}
        tone={toneFor(analytics?.calmar, (x) => x >= 1)}
        hint="CAGR / |max DD|"
      />
      <Tile
        icon={Percent}
        label="Ann. Volatility"
        value={analytics?.annVol != null ? `${analytics.annVol.toFixed(1)}%` : '\u2014'}
        hint={`stdev \u00d7 \u221A252`}
      />
      <Tile
        icon={TrendingDown}
        label="Max Drawdown"
        value={`${metrics.maxDrawdown?.toFixed(2) ?? 0}%`}
        tone="negative"
        hint="peak-to-trough"
      />
      <Tile
        icon={Timer}
        label="DD Duration"
        value={`${analytics?.maxDDDurationDays ?? 0}d`}
        hint="longest underwater"
      />
      <Tile
        icon={AlertTriangle}
        label="Daily VaR 95%"
        value={`-${analytics?.var95Daily?.toFixed(2) ?? '0.00'}%`}
        tone="negative"
        hint="5th percentile"
      />
      <Tile
        icon={Zap}
        label="Alpha vs B&H"
        value={`${metrics.alpha >= 0 ? '+' : ''}${metrics.alpha?.toFixed(2) ?? '\u2014'}%`}
        tone={toneFor(metrics.alpha, (x) => x >= 0)}
        hint={`${tradeCount} trades · ${applyCosts ? 'net' : 'gross'}`}
      />
    </div>
  );
}
