import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Clock, Layers, Database, SearchX } from 'lucide-react';

const API = 'http://localhost:8000/api';

function fmtAge(iso) {
  if (!iso) return '—';
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return `${Math.round(sec)}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

function QualityWarnings() {
  const [audit, setAudit] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/quality/audit?recent=false`);
      if (!r.ok) { setErr(`HTTP ${r.status}`); return; }
      setAudit(await r.json());
      setErr(null);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAudit();
    const iv = setInterval(fetchAudit, 60000);
    return () => clearInterval(iv);
  }, [fetchAudit]);

  if (err) return <div className="dq-error-panel"><AlertCircle size={16} /><strong>Quality audit unavailable</strong><span>Start the FastAPI service and refresh to load audit checks.</span></div>;
  if (!audit) return null;

  const { summary, results } = audit;
  const flagged = results.filter((r) => r.severity !== 'ok' && r.severity !== 'info');
  const allClean = flagged.length === 0;

  const sevPalette = {
    critical: { color: '#ef4444', label: 'CRITICAL' },
    error:    { color: '#ef4444', label: 'ERROR' },
    warning:  { color: '#f59e0b', label: 'WARN' },
    info:     { color: '#60a5fa', label: 'INFO' },
  };

  return (
    <div className="quality-warnings">
      <div className="quality-warnings-header">
        <AlertCircle size={14} />
        <span>Quality Gate</span>
        <span className="quality-summary-pill" style={{ borderColor: allClean ? '#00c9a7' : '#f59e0b' }}>
          {summary.critical > 0 && <span style={{ color: '#ef4444' }}>{summary.critical} critical · </span>}
          {summary.warnings > 0 && <span style={{ color: '#f59e0b' }}>{summary.warnings} warn · </span>}
          {summary.info > 0 && <span style={{ color: '#60a5fa' }}>{summary.info} info · </span>}
          <span style={{ color: '#00c9a7' }}>{summary.ok} clean</span>
        </span>
        <button onClick={fetchAudit} disabled={loading} className="quality-refresh">
          <RefreshCw size={11} className={loading ? 'spin-icon' : ''} />
        </button>
      </div>

      {allClean ? (
        <div className="quality-clean">
          <CheckCircle size={14} /> All {summary.total_tickers} tickers pass hard checks. No stale data, no gaps beyond NSE holidays.
        </div>
      ) : (
        <div className="quality-flagged">
          {flagged.map((r) => {
            const pal = sevPalette[r.severity] || sevPalette.info;
            const issues = [];
            if (r.hard_failures?.length) issues.push(`${r.hard_failures.length} hard fail${r.hard_failures.length > 1 ? 's' : ''}`);
            if (r.soft_warnings?.length) issues.push(`${r.soft_warnings.length} soft warn${r.soft_warnings.length > 1 ? 's' : ''}`);
            if (r.gap_count > 0) issues.push(`${r.gap_count} date gap${r.gap_count > 1 ? 's' : ''}`);
            if (r.stale) issues.push(`stale ${r.days_behind}d`);
            return (
              <div key={r.ticker} className="quality-row" style={{ borderLeftColor: pal.color }}>
                <span className="quality-row-sev" style={{ color: pal.color }}>{pal.label}</span>
                <span className="quality-row-ticker">{r.ticker}</span>
                <span className="quality-row-issues">{issues.join(' · ')}</span>
                {r.gap_sample?.length > 0 && (
                  <span className="quality-row-sample">e.g. {r.gap_sample.slice(0, 3).join(', ')}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MedallionHealth() {
  const [snap, setSnap] = useState(null);
  const [err, setErr] = useState(null);

  const fetchSnap = useCallback(async () => {
    try {
      const r = await fetch(`${API}/health/pipeline`);
      if (!r.ok) { setErr(`HTTP ${r.status}`); return; }
      setSnap(await r.json());
      setErr(null);
    } catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => {
    fetchSnap();
    const iv = setInterval(fetchSnap, 5000);
    return () => clearInterval(iv);
  }, [fetchSnap]);

  if (err) return <div className="dq-error-panel"><AlertCircle size={16} /><strong>Pipeline health unavailable</strong><span>Live medallion health cannot be reached while the API is offline.</span></div>;
  if (!snap) return <div className="dq-empty">Loading pipeline health…</div>;

  const tickRate = snap.bronze?.ticks_per_minute ?? 0;
  const isFlowing = tickRate > 0;

  return (
    <div className="medallion-health">
      <div className="medallion-header">
        <Layers size={14} />
        <span>Medallion Pipeline Health</span>
        <span className={`pulse-dot ${isFlowing ? 'on' : 'off'}`} />
        <span className="medallion-rate">
          {isFlowing
            ? `${tickRate} ticks/min · ${snap.redis_latest_symbols} symbols live`
            : 'No live ticks'}
        </span>
      </div>
      <div className="medallion-grid">
        <div className="medallion-card bronze">
          <div className="medallion-card-label">Bronze · raw ticks</div>
          <div className="medallion-card-value">{(snap.bronze?.rows ?? 0).toLocaleString()}</div>
          <div className="medallion-card-sub">
            {snap.bronze?.instruments ?? 0} instruments · last {fmtAge(snap.bronze?.latest_ts)}
          </div>
          <div className="medallion-card-meta">{snap.bronze?.table}</div>
        </div>
        <div className="medallion-card silver">
          <div className="medallion-card-label">Silver · 1-min OHLCV</div>
          <div className="medallion-card-value">{(snap.silver?.bars ?? 0).toLocaleString()}</div>
          <div className="medallion-card-sub">
            {snap.silver?.instruments ?? 0} instruments · last {fmtAge(snap.silver?.latest_bucket)}
          </div>
          <div className="medallion-card-meta">{snap.silver?.table}</div>
        </div>
        <div className="medallion-card gold">
          <div className="medallion-card-label">Gold · 5-min rollup</div>
          <div className="medallion-card-value">{(snap.gold_5min?.bars ?? 0).toLocaleString()}</div>
          <div className="medallion-card-sub">last {fmtAge(snap.gold_5min?.latest_bucket)}</div>
          <div className="medallion-card-meta">{snap.gold_5min?.view}</div>
        </div>
        <div className="medallion-card gold">
          <div className="medallion-card-label">Gold · daily rollup</div>
          <div className="medallion-card-value">{(snap.gold_daily?.bars ?? 0).toLocaleString()}</div>
          <div className="medallion-card-sub">last {snap.gold_daily?.latest_bucket ?? '—'}</div>
          <div className="medallion-card-meta">{snap.gold_daily?.view}</div>
        </div>
        <div className="medallion-card raw">
          <div className="medallion-card-label">Raw · EOD warehouse</div>
          <div className="medallion-card-value">{(snap.raw?.rows ?? 0).toLocaleString()}</div>
          <div className="medallion-card-sub">
            {snap.raw?.tickers ?? 0} tickers · through {snap.raw?.latest_date ?? '—'}
          </div>
          <div className="medallion-card-meta">{snap.raw?.table}</div>
        </div>
      </div>
    </div>
  );
}

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

function FriendlyError({ title = 'Data service unavailable', message, onRetry }) {
  return (
    <div className="dq-state-panel dq-state-error" role="alert">
      <AlertCircle size={22} />
      <div>
        <strong>{title}</strong>
        <span>{message || 'The API did not respond. Start the FastAPI service, then refresh this panel.'}</span>
      </div>
      {onRetry && (
        <button className="dq-state-action" onClick={onRetry}>
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}

function EmptyInventory({ onRetry }) {
  return (
    <tr>
      <td colSpan="7">
        <div className="dq-empty-inventory">
          <SearchX size={22} />
          <strong>No tickers in inventory</strong>
          <span>Add symbols from the Backtest Engine or run a backfill to populate coverage, freshness, and quality metrics.</span>
          <button className="dq-state-action" onClick={onRetry}>
            <Database size={14} /> Refresh Inventory
          </button>
        </div>
      </td>
    </tr>
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

      // Staleness: latest EOD trade_date across the universe. Using
      // `latest_date` (the actual data freshness) instead of `last_backfill_at`
      // (the metadata column that's null for tickers added before the audit
      // trail was wired up).
      const latestDates = data
        .map((t) => t.latest_date)
        .filter(Boolean)
        .sort()
        .reverse();
      const mostRecentBackfill = latestDates[0];
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

      {error && (
        <FriendlyError
          message="Universe, coverage, and freshness metrics are temporarily unavailable."
          onRetry={fetchUniverse}
        />
      )}

      <MedallionHealth />
      <QualityWarnings />

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
            {stats.daysSinceMostRecent != null ? `${stats.daysSinceMostRecent}d ago` : 'N/A'}
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
              {sortedUniverse.length === 0 && !loading && <EmptyInventory onRetry={fetchUniverse} />}
              {loading && sortedUniverse.length === 0 && (
                <tr>
                  <td colSpan="7">
                    <div className="dq-table-skeleton">
                      <span /><span /><span />
                    </div>
                  </td>
                </tr>
              )}
              {sortedUniverse.map((t) => {
                const daysStale = t.latest_date
                  ? Math.floor((Date.now() - new Date(t.latest_date).getTime()) / (1000 * 60 * 60 * 24))
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
