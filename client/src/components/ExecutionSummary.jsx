// The 30% right panel of the tearsheet: aggregate execution stats + exit-reason
// mix + transaction costs. Replaces the need for a separate "Performance" tab.

function fmtINR(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function Stat({ label, value, tone }) {
  return (
    <div className="es-row">
      <span className="es-label">{label}</span>
      <span className={`es-value ${tone || ''}`}>{value}</span>
    </div>
  );
}

const REASON_LABELS = { signal: 'Signal', stop: 'Stop-loss', force_close: 'End of data' };

export default function ExecutionSummary({ metrics, analytics, trades, costBreakdown, applyCosts }) {
  if (!metrics) return null;
  const t = analytics?.trades;

  // Exit-reason mix — surfaces how often the risk model's stop did the work.
  const reasonCounts = {};
  (trades || []).forEach((tr) => {
    const r = tr.exitReason || 'signal';
    reasonCounts[r] = (reasonCounts[r] || 0) + 1;
  });
  const reasonEntries = Object.entries(reasonCounts);

  return (
    <div className="panel exec-summary">
      <div className="panel-title-row">
        <span className="panel-title">Risk &amp; Execution</span>
        <span className="panel-sub">{metrics.totalTrades} trades</span>
      </div>

      <div className="es-section">
        <Stat label="Total Trades" value={metrics.totalTrades} />
        <Stat label="Win Rate" value={`${metrics.winRate.toFixed(1)}%`} tone={metrics.winRate >= 50 ? 'positive' : 'negative'} />
        {t && <Stat label="Profit Factor" value={t.profitFactor.toFixed(2)} tone={t.profitFactor >= 1 ? 'positive' : 'negative'} />}
        {t && <Stat label="Expectancy / trade" value={fmtINR(t.expectancy)} tone={t.expectancy >= 0 ? 'positive' : 'negative'} />}
      </div>

      {t && (
        <div className="es-section">
          <div className="es-section-head">Winners vs Losers</div>
          <Stat label="Avg Winner" value={fmtINR(t.avgWin)} tone="positive" />
          <Stat label="Avg Loser" value={fmtINR(-t.avgLoss)} tone="negative" />
          <Stat label="Payoff Ratio" value={t.payoffRatio.toFixed(2)} />
          <Stat label="Best / Worst" value={`${fmtINR(t.best)} / ${fmtINR(t.worst)}`} />
        </div>
      )}

      {reasonEntries.length > 0 && (
        <div className="es-section">
          <div className="es-section-head">How Trades Exited</div>
          {reasonEntries.map(([r, n]) => (
            <Stat
              key={r}
              label={REASON_LABELS[r] || r}
              value={`${n} (${((n / metrics.totalTrades) * 100).toFixed(0)}%)`}
              tone={r === 'stop' ? 'negative' : ''}
            />
          ))}
        </div>
      )}

      {costBreakdown && (
        <div className="es-section">
          <div className="es-section-head">
            Costs {applyCosts ? '(applied)' : '(modeled, gross view)'}
          </div>
          <Stat label="Brokerage + STT" value={fmtINR(costBreakdown.brokerage + costBreakdown.stt)} tone="negative" />
          <Stat label="Slippage" value={fmtINR(costBreakdown.slippage)} tone="negative" />
          <Stat label="GST + Fees" value={fmtINR(costBreakdown.gst + costBreakdown.exchangeFees)} tone="negative" />
          <Stat label="Total Costs" value={fmtINR(costBreakdown.totalCosts)} tone="negative" />
          <Stat label="% of Capital" value={`${costBreakdown.costPctOfCapital.toFixed(2)}%`} />
        </div>
      )}
    </div>
  );
}
