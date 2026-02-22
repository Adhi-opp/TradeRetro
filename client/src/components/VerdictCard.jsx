import { ShieldCheck, ShieldAlert, ShieldX, AlertTriangle } from 'lucide-react';

const VERDICT_CONFIG = {
  LEGIT:        { icon: ShieldCheck,  color: '#22c55e', bg: 'rgba(34,197,94,0.08)'  },
  EXAGGERATED:  { icon: AlertTriangle, color: '#eab308', bg: 'rgba(234,179,8,0.08)' },
  MISLEADING:   { icon: ShieldAlert,  color: '#f97316', bg: 'rgba(249,115,22,0.08)' },
  BS:           { icon: ShieldX,      color: '#ef4444', bg: 'rgba(239,68,68,0.08)'  },
  NO_CLAIMS:    { icon: ShieldCheck,  color: '#6b7280', bg: 'rgba(107,114,128,0.08)'},
};

export default function VerdictCard({ data }) {
  if (!data) return null;

  const { verdict, actual_results, stock, data_range } = data;
  const config = VERDICT_CONFIG[verdict.label] || VERDICT_CONFIG.NO_CLAIMS;
  const Icon = config.icon;

  return (
    <div className="results-container">
      {/* Verdict Banner */}
      <div className="verdict-banner" style={{ borderColor: config.color, background: config.bg }}>
        <div className="verdict-header">
          <Icon size={36} color={config.color} />
          <div>
            <div className="verdict-label" style={{ color: config.color }}>
              {verdict.label === 'NO_CLAIMS' ? 'RAW RESULTS' : verdict.label}
            </div>
            {verdict.truth_score_pct !== null && (
              <div className="verdict-score">
                Truth Score: <strong>{verdict.truth_score_pct}%</strong>
              </div>
            )}
          </div>
        </div>
        <p className="verdict-detail">{verdict.detail}</p>
      </div>

      {/* Comparisons Table */}
      {verdict.comparisons && verdict.comparisons.length > 0 && (
        <div className="panel">
          <div className="panel-title">Claims vs Reality</div>
          <div className="table-scroll">
            <table className="trade-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>AI Claimed</th>
                  <th>Actual</th>
                  <th>Gap</th>
                </tr>
              </thead>
              <tbody>
                {verdict.comparisons.map((c) => (
                  <tr key={c.metric}>
                    <td>{c.metric}</td>
                    <td>{c.claimed}{c.unit}</td>
                    <td>{c.actual}{c.unit}</td>
                    <td style={{ color: c.gap > 5 ? '#ef4444' : c.gap < -5 ? '#22c55e' : '#9ca3af' }}>
                      {c.gap > 0 ? '+' : ''}{c.gap}{c.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actual Metrics */}
      <div className="panel">
        <div className="panel-title">Backtest Results — {stock}</div>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Total Return</div>
            <div className={'metric-value ' + (actual_results.total_return >= 0 ? 'positive' : 'negative')}>
              {actual_results.total_return >= 0 ? '+' : ''}{actual_results.total_return}%
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Win Rate</div>
            <div className={'metric-value ' + (actual_results.win_rate >= 50 ? 'positive' : 'negative')}>
              {actual_results.win_rate}%
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Max Drawdown</div>
            <div className="metric-value negative">{actual_results.max_drawdown}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Total Trades</div>
            <div className="metric-value">{actual_results.total_trades}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Winning</div>
            <div className="metric-value positive">{actual_results.winning_trades}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Losing</div>
            <div className="metric-value negative">{actual_results.losing_trades}</div>
          </div>
        </div>
        {data_range && (
          <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.75rem', textAlign: 'center' }}>
            Data: {data_range.start} to {data_range.end} ({data_range.total_candles} candles)
          </p>
        )}
      </div>
    </div>
  );
}
