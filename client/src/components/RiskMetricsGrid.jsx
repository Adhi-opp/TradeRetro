import {
  Activity, Gauge, Zap, AlertTriangle, Timer, Target, TrendingDown, Percent, Sigma,
} from 'lucide-react';

import { ratio } from './KpiRibbon';

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
        value={ratio(metrics.sharpeRatio)}
        tone={toneFor(metrics.sharpeRatio, (x) => x >= 1)}
        hint="annualized, rf 6.5%"
      />
      <Tile
        icon={Target}
        label="Sortino"
        value={ratio(metrics.sortinoRatio)}
        tone={toneFor(metrics.sortinoRatio, (x) => x >= 1)}
        hint={
          analytics?.downsideDeviation != null
            ? `downside dev ${analytics.downsideDeviation.toFixed(1)}%`
            : 'downside deviation, rf 6.5%'
        }
      />
      <Tile
        icon={Gauge}
        label="Calmar"
        value={ratio(metrics.calmarRatio)}
        tone={toneFor(metrics.calmarRatio, (x) => x >= 1)}
        hint="CAGR / |max DD|"
      />
      <Tile
        icon={Percent}
        label="Ann. Volatility"
        value={metrics.annualizedVolatility != null ? `${metrics.annualizedVolatility.toFixed(1)}%` : '\u2014'}
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
        value={`-${metrics.var95Daily?.toFixed(2) ?? '0.00'}%`}
        tone="negative"
        hint="5th percentile"
      />
      <Tile
        icon={Zap}
        label="Excess CAGR"
        value={`${metrics.excessCagr >= 0 ? '+' : ''}${metrics.excessCagr?.toFixed(2) ?? '\u2014'}%`}
        tone={toneFor(metrics.excessCagr, (x) => x >= 0)}
        hint={`${tradeCount} trades · ${applyCosts ? 'net' : 'gross'}`}
      />
      <Tile
        icon={Sigma}
        label="Jensen's alpha"
        value={`${metrics.jensensAlpha >= 0 ? '+' : ''}${metrics.jensensAlpha?.toFixed(2) ?? '—'}%`}
        tone={toneFor(metrics.jensensAlpha, (x) => x >= 0)}
        hint={
          metrics.beta != null
            ? `β ${metrics.beta.toFixed(2)} · R² ${(metrics.betaRSquared ?? 0).toFixed(2)}`
            : 'regression vs B&H'
        }
      />
    </div>
  );
}
