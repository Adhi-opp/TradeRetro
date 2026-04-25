import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';

const API = 'http://localhost:8000/api';

function QualityBadge({ status, text }) {
  const colour = {
    good: 'var(--accent, #00c9a7)',
    warning: '#f59e0b',
    critical: '#ef4444',
  }[status] || 'var(--text-secondary)';

  const icon = {
    good: CheckCircle,
    warning: AlertCircle,
    critical: AlertCircle,
  }[status] || Clock;

  const Icon = icon;
  return (
    <div className="quality-badge" style={{ borderColor: colour, color: colour }}>
      <Icon size={13} />
      {text}
    </div>
  );
}

function PercentBar({ percent, label = '' }) {
  return (
    <div className="percent-bar-container">
      <div className="percent-bar" style={{ width: `${Math.min(100, percent)}%` }} />
      <span className="percent-label">{label || `${percent.toFixed(1)}%`}</span>
    </div>
  );
}

export default function DataQualityDashboard() {
  const [universe, setUniverse] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [error, setError] = useState(null);

  const fetchUniverse = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/universe`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setUniverse(Array.isArray(data) ? data : []);

      // Compute stats
      const totalTickers = data.length;
      const completedTickers = data.filter((t) => t.backfill_status === 'completed').length;
      const totalRows = data.reduce((sum, t) => sum + (t.row_count || 0), 0);
      const avgRowCount = totalTickers > 0 ? Math.round(totalRows / totalTickers) : 0;

      // Staleness: most recent backfill
      const recentBackfills = data
        .map((t) => t.last_backfill_at)
        .filter(Boolean)
        .sort()
        .reverse();
      const mostRecentBackfill = recentBackfills[0];
      const daysSinceMostRecent = mostRecentBackfill
        ? Math.floor((Date.now() - new Date(mostRecentBackfill).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      setStats({
        totalTickers,
        completedTickers,
        completionRate: totalTickers > 0 ? (completedTickers / totalTickers) * 100 : 0,
        totalRows,
        avgRowCount,
        mostRecentBackfill,
        daysSinceMostRecent,
      });
    } catch (e) {
      setError(e.message);
      console.error('DataQualityDashboard fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUniverse();
    const iv = setInterval(fetchUniverse, 30000); // refresh every 30s
    return () => clearInterval(iv);
  }, [fetchUniverse]);

  const sortedUniverse = [...universe].sort((a, b) => {
    // Completed first, then by row_count desc
    if (a.backfill_status !== b.backfill_status) {
      return a.backfill_status === 'completed' ? -1 : 1;
    }
    return (b.row_count || 0) - (a.row_count || 0);
  });

  return (
    <div className="data-quality-dashboard">
      {/* Header Stats */}
      <div className="dq-header">
        <div className="dq-title">Data Quality Monitor</div>
        <button
          className="dq-refresh-btn"
          onClick={fetchUniverse}
          disabled={loading}
          title="Refresh universe"
        >
          <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
        </button>
      </div>

      {error && <div className="dq-error">Error: {error}</div>}

      {/* Summary Stats */}
      <div className="dq-stats-grid">
        <div className="dq-stat-card">
          <div className="dq-stat-label">Coverage</div>
          <div className="dq-stat-value">{stats.completedTickers || 0} / {stats.totalTickers || 0}</div>
          <PercentBar percent={stats.completionRate || 0} />
          <div className="dq-stat-hint">{stats.completionRate?.toFixed(0)}% backfilled</div>
        </div>

        <div className="dq-stat-card">
          <div className="dq-stat-label">Total Rows</div>
          <div className="dq-stat-value">{(stats.totalRows || 0).toLocaleString()}</div>
          <div className="dq-stat-subtext">Avg {stats.avgRowCount || 0}/ticker</div>
        </div>

        <div className="dq-stat-card">
          <div className="dq-stat-label">Freshness</div>
          <div className="dq-stat-value">
            {stats.daysSinceMostRecent !== null ? `${stats.daysSinceMostRecent}d ago` : 'N/A'}
          </div>
          <div className="dq-stat-hint">Most recent backfill</div>
        </div>

        <div className="dq-stat-card">
          <div className="dq-stat-label">Pipeline Status</div>
          <QualityBadge
            status={stats.completionRate >= 90 ? 'good' : stats.completionRate >= 70 ? 'warning' : 'critical'}
            text={stats.completionRate >= 90 ? 'Healthy' : stats.completionRate >= 70 ? 'Degraded' : 'Critical'}
          />
        </div>
      </div>

      {/* Ticker Table */}
      <div className="dq-table-section">
        <div className="dq-table-title">Ticker Inventory</div>
        <div className="dq-table-container">
          <table className="dq-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Asset Class</th>
                <th>Status</th>
                <th>Rows</th>
                <th>Date Range</th>
                <th>Freshness</th>
                <th>Quality</th>
              </tr>
            </thead>
            <tbody>
              {sortedUniverse.map((t) => {
                const daysStale = t.last_backfill_at
                  ? Math.floor((Date.now() - new Date(t.last_backfill_at).getTime()) / (1000 * 60 * 60 * 24))
                  : null;

                const freshnessStatus =
                  daysStale === null ? 'critical' : daysStale <= 1 ? 'good' : daysStale <= 7 ? 'warning' : 'critical';

                const qualityPercent = t.row_count && t.earliest_date && t.latest_date
                  ? Math.min(100, (t.row_count / 500) * 100) // Assume ~500 days as baseline
                  : 0;

                return (
                  <tr key={t.symbol} className={`dq-row dq-row-${t.backfill_status}`}>
                    <td className="dq-cell-symbol">
                      <span className="dq-symbol-code">{t.symbol}</span>
                      <span className="dq-symbol-name">{t.display_name}</span>
                    </td>
                    <td>
                      <span className={`dq-asset-badge ac-${t.asset_class}`}>{t.asset_class}</span>
                    </td>
                    <td>
                      <QualityBadge
                        status={
                          t.backfill_status === 'completed'
                            ? 'good'
                            : t.backfill_status === 'running'
                              ? 'warning'
                              : 'critical'
                        }
                        text={
                          t.backfill_status === 'completed'
                            ? 'Done'
                            : t.backfill_status === 'running'
                              ? 'Running'
                              : t.backfill_status === 'pending'
                                ? 'Pending'
                                : 'Failed'
                        }
                      />
                    </td>
                    <td className="dq-cell-numeric">{(t.row_count || 0).toLocaleString()}</td>
                    <td className="dq-cell-date">
                      {t.earliest_date && t.latest_date
                        ? `${t.earliest_date.split('-')[0]} → ${t.latest_date.split('-')[0]}`
                        : '—'}
                    </td>
                    <td>
                      {daysStale !== null && (
                        <span className={`dq-freshness dq-freshness-${freshnessStatus}`}>
                          {daysStale}d ago
                        </span>
                      )}
                      {daysStale === null && <span className="dq-freshness dq-freshness-critical">N/A</span>}
                    </td>
                    <td>
                      <div className="dq-quality-bar">
                        <div className="dq-quality-fill" style={{ width: `${qualityPercent}%` }} />
                        <span className="dq-quality-text">{qualityPercent.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
