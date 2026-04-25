function fmtINR(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}\u20B9${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function Row({ label, value, cls, hint }) {
  return (
    <div className="ts-row">
      <span className="ts-label">{label}</span>
      <span className={`ts-value ${cls || ''}`}>
        {value}
        {hint && <span className="ts-hint">{hint}</span>}
      </span>
    </div>
  );
}

export default function TradeStats({ stats, avgHoldingPeriod }) {
  if (!stats) return null;

  return (
    <div className="panel tradestats-panel">
      <div className="panel-title-row">
        <span className="panel-title">Trade Analytics</span>
        <span className="panel-sub">{stats.total} closed trades</span>
      </div>

      <div className="ts-grid">
        <div className="ts-col">
          <div className="ts-col-head">Frequency</div>
          <Row label="Total Trades" value={stats.total} />
          <Row label="Winners" value={stats.wins} cls="positive" />
          <Row label="Losers" value={stats.losses} cls="negative" />
          <Row label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} cls={stats.winRate >= 50 ? 'positive' : 'negative'} />
        </div>

        <div className="ts-col">
          <div className="ts-col-head">Performance</div>
          <Row label="Profit Factor" value={stats.profitFactor.toFixed(2)} cls={stats.profitFactor >= 1 ? 'positive' : 'negative'} />
          <Row label="Payoff Ratio" value={stats.payoffRatio.toFixed(2)} />
          <Row label="Expectancy / trade" value={fmtINR(stats.expectancy)} cls={stats.expectancy >= 0 ? 'positive' : 'negative'} />
          <Row label="Avg Holding" value={`${stats.avgHold.toFixed(1)}d`} />
        </div>

        <div className="ts-col">
          <div className="ts-col-head">Extremes</div>
          <Row label="Best Trade" value={fmtINR(stats.best)} cls="positive" />
          <Row label="Worst Trade" value={fmtINR(stats.worst)} cls="negative" />
          <Row label="Avg Win" value={fmtINR(stats.avgWin)} cls="positive" />
          <Row label="Avg Loss" value={fmtINR(-stats.avgLoss)} cls="negative" />
        </div>

        <div className="ts-col">
          <div className="ts-col-head">Streaks</div>
          <Row label="Max Win Streak" value={`${stats.streakWin}`} cls="positive" />
          <Row label="Max Loss Streak" value={`${stats.streakLoss}`} cls="negative" />
        </div>
      </div>
    </div>
  );
}
