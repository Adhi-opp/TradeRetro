import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Loader, RefreshCw } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const API = 'http://localhost:8000/api/correlation';

// Display label → warehouse key.
const UNIVERSE = [
  { key: 'NIFTY50.NS',    label: 'NIFTY 50',    group: 'index'  },
  { key: 'BANKNIFTY.NS',  label: 'BANK NIFTY',  group: 'index'  },
  { key: 'RELIANCE.NS',   label: 'RELIANCE',    group: 'equity' },
  { key: 'HDFCBANK.NS',   label: 'HDFC BANK',   group: 'equity' },
  { key: 'ICICIBANK.NS',  label: 'ICICI BANK',  group: 'equity' },
  { key: 'SBIN.NS',       label: 'SBIN',        group: 'equity' },
  { key: 'TCS.NS',        label: 'TCS',         group: 'equity' },
  { key: 'INFY.NS',       label: 'INFY',        group: 'equity' },
  { key: 'HCLTECH.NS',    label: 'HCL TECH',    group: 'equity' },
  { key: 'ITC.NS',        label: 'ITC',         group: 'equity' },
  { key: 'BHARTIARTL.NS', label: 'BHARTI',      group: 'equity' },
  { key: 'BAJFINANCE.NS', label: 'BAJ FIN',     group: 'equity' },
  { key: 'USDINR',        label: 'USD/INR',     group: 'macro'  },
  { key: 'CRUDE',         label: 'CRUDE',       group: 'macro'  },
];

const LABEL = Object.fromEntries(UNIVERSE.map((u) => [u.key, u.label]));
const DEFAULT_PEERS = ['RELIANCE.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'USDINR', 'CRUDE'];

// Peer colour rotation (recharts line colours).
const PEER_COLOURS = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4'];

// ── Utility: red → neutral → green interpolation for the heatmap ──
function corrToRGBA(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return 'rgba(120,120,120,0.08)';
  const clamped = Math.max(-1, Math.min(1, v));
  const abs = Math.abs(clamped);
  if (clamped >= 0) {
    return `rgba(34,197,94,${0.12 + abs * 0.55})`;
  }
  return `rgba(239,68,68,${0.12 + abs * 0.55})`;
}

function corrTextColour(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return 'var(--text-muted)';
  if (Math.abs(v) > 0.45) return '#fff';
  return 'var(--text-primary)';
}


// ══════════════════════════════════════════════════════════════
// Panel shell
// ══════════════════════════════════════════════════════════════

function Panel({ title, subtitle, badge, children, actions }) {
  return (
    <div className="panel corr-panel">
      <div className="corr-panel-header">
        <div>
          <div className="panel-title">{title}</div>
          {subtitle && <div className="corr-panel-subtitle">{subtitle}</div>}
        </div>
        <div className="corr-panel-header-right">
          {actions}
          {badge && <span className="corr-panel-badge">{badge}</span>}
        </div>
      </div>
      {children}
    </div>
  );
}


function WarmupState({ data, what }) {
  const required = data?.required;
  const available = data?.available;
  const reason = data?.reason;
  return (
    <div className="corr-warmup">
      <div className="corr-warmup-title">Warming up · not enough warehouse data yet</div>
      <div className="corr-warmup-body">
        {what} needs more {required ? `≈ ${required}` : ''} observations.
        {available != null && ` Currently have ${available}.`}
      </div>
      {reason && <div className="corr-warmup-reason">{reason}</div>}
      <div className="corr-warmup-hint">
        Run <code>POST /api/ingest/backfill</code> for the universe (including
        <code> USDINR</code> and <code>CRUDE</code>) then retry.
      </div>
    </div>
  );
}


function LoadingSkeleton({ height = 240 }) {
  return (
    <div className="corr-loading" style={{ minHeight: height }}>
      <Loader className="spin-icon" size={18} />
      <span>Loading from warehouse…</span>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// Panel 1 — Correlation Matrix (CSS-grid heatmap)
// ══════════════════════════════════════════════════════════════

function CorrelationMatrix({ windowDays, onWindowChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`${API}/matrix?window_days=${windowDays}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setData(d);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => { fetchMatrix(); }, [fetchMatrix]);

  const actions = (
    <div className="corr-control-group">
      {[10, 20, 60].map((w) => (
        <button
          key={w}
          className={`corr-chip ${w === windowDays ? 'corr-chip-active' : ''}`}
          onClick={() => onWindowChange(w)}
          disabled={loading}
        >
          {w}d
        </button>
      ))}
      <button className="corr-icon-btn" onClick={fetchMatrix} disabled={loading} title="Refresh">
        <RefreshCw size={13} />
      </button>
    </div>
  );

  return (
    <Panel
      title="Cross-Asset Correlation Matrix"
      subtitle={`Pairwise Pearson on log-returns · ${windowDays}-day window`}
      actions={actions}
      badge={data?.n_samples ? `${data.n_samples} bars` : null}
    >
      {loading && <LoadingSkeleton />}
      {err && <div className="corr-error">error: {err}</div>}
      {!loading && !err && data?.status === 'insufficient_data' && (
        <WarmupState data={data} what="Matrix" />
      )}
      {!loading && !err && data?.status === 'ok' && (
        <MatrixGrid tickers={data.tickers} matrix={data.matrix} />
      )}
      {data?.excluded_due_to_missing_data?.length > 0 && (
        <div className="corr-excluded">
          Excluded (not enough data):{' '}
          {data.excluded_due_to_missing_data
            .map((e) => `${LABEL[e.ticker] || e.ticker} (${e.observations}/${e.required})`)
            .join(', ')}
        </div>
      )}
    </Panel>
  );
}


function MatrixGrid({ tickers, matrix }) {
  const n = tickers.length;
  const cellSize = n > 10 ? 38 : 48;
  return (
    <div className="corr-matrix-scroll">
      <div
        className="corr-matrix-grid"
        style={{
          gridTemplateColumns: `84px repeat(${n}, ${cellSize}px)`,
          gridAutoRows: `${cellSize}px`,
        }}
      >
        <div className="corr-matrix-corner" />
        {tickers.map((t) => (
          <div key={`col-${t}`} className="corr-matrix-header">{LABEL[t] || t}</div>
        ))}
        {tickers.map((row, ri) => (
          <FragmentRow key={`row-${row}`} row={row} rowIndex={ri} tickers={tickers} matrix={matrix} />
        ))}
      </div>
    </div>
  );
}


function FragmentRow({ row, rowIndex, tickers, matrix }) {
  return (
    <>
      <div className="corr-matrix-row-label">{LABEL[row] || row}</div>
      {tickers.map((col, ci) => {
        const v = matrix[rowIndex][ci];
        return (
          <div
            key={`cell-${row}-${col}`}
            className="corr-matrix-cell"
            style={{ background: corrToRGBA(v), color: corrTextColour(v) }}
            title={`${LABEL[row] || row} vs ${LABEL[col] || col}: ${v?.toFixed(3)}`}
          >
            {v == null ? '·' : v.toFixed(2)}
          </div>
        );
      })}
    </>
  );
}


// ══════════════════════════════════════════════════════════════
// Panel 2 — Rolling Correlation History
// ══════════════════════════════════════════════════════════════

function RollingCorrelation({ base, peers, windowDays, lookbackDays }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const peerParams = peers.map((p) => `peers=${encodeURIComponent(p)}`).join('&');
      const url = `${API}/rolling?base=${encodeURIComponent(base)}&${peerParams}`
        + `&window_days=${windowDays}&lookback_days=${lookbackDays}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [base, peers, windowDays, lookbackDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Merge peer series into one array keyed by date for recharts.
  const chartData = useMemo(() => {
    if (!data?.series?.length) return [];
    const byDate = new Map();
    for (const s of data.series) {
      for (const p of s.points) {
        if (!byDate.has(p.date)) byDate.set(p.date, { date: p.date });
        byDate.get(p.date)[s.peer] = p.corr;
      }
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  return (
    <Panel
      title="Rolling Correlation History"
      subtitle={`${LABEL[base] || base} vs peers · ${windowDays}-day window · last ${lookbackDays} bars`}
      badge={data?.status === 'ok' ? `${data.series.length} peers` : null}
    >
      {loading && <LoadingSkeleton />}
      {err && <div className="corr-error">error: {err}</div>}
      {!loading && !err && data?.status === 'insufficient_data' && (
        <WarmupState data={data} what="Rolling correlation" />
      )}
      {!loading && !err && data?.status === 'ok' && chartData.length > 0 && (
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
              <XAxis
                dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                minTickGap={32}
              />
              <YAxis
                domain={[-1, 1]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                ticks={[-1, -0.5, 0, 0.5, 1]}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-panel)', border: '1px solid var(--border)',
                  borderRadius: 6, fontSize: 12,
                }}
                formatter={(v) => (v == null ? '—' : v.toFixed(3))}
              />
              <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="3 3" />
              {data.series.map((s, i) => (
                <Line
                  key={s.peer} dataKey={s.peer} name={LABEL[s.peer] || s.peer}
                  stroke={PEER_COLOURS[i % PEER_COLOURS.length]}
                  strokeWidth={1.5} dot={false} isAnimationActive={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}


// ══════════════════════════════════════════════════════════════
// Panel 3 — Lead-Lag proxy
// ══════════════════════════════════════════════════════════════

function LeadLag({ base, peers, maxLag, windowDays }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [showTip, setShowTip] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const peerParams = peers.map((p) => `peers=${encodeURIComponent(p)}`).join('&');
      const url = `${API}/leadlag?base=${encodeURIComponent(base)}&${peerParams}`
        + `&max_lag=${maxLag}&window_days=${windowDays}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [base, peers, maxLag, windowDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tooltip = (
    <span className="corr-info-btn" onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
      <Info size={13} />
      {showTip && (
        <span className="corr-info-popup">
          Lagged-correlation proxy — NOT true Granger causality.
          Positive best-lag means the peer tends to lead {LABEL[base] || base}.
        </span>
      )}
    </span>
  );

  return (
    <Panel
      title={<>Lead-Lag Proxy {tooltip}</>}
      subtitle={`Best lag k ∈ [−${maxLag}, +${maxLag}] bars · ${windowDays}-bar window`}
      badge="proxy"
    >
      {loading && <LoadingSkeleton height={180} />}
      {err && <div className="corr-error">error: {err}</div>}
      {!loading && !err && data?.status === 'insufficient_data' && (
        <WarmupState data={data} what="Lead-lag proxy" />
      )}
      {!loading && !err && data?.status === 'ok' && (
        <div className="corr-leadlag">
          {data.results.map((r) => <LeadLagRow key={r.peer} row={r} maxLag={maxLag} />)}
        </div>
      )}
    </Panel>
  );
}


function LeadLagRow({ row, maxLag }) {
  // Center line = sync. Negative lag → base leads (bar grows left). Positive → peer leads (bar right).
  const pct = Math.min(100, (Math.abs(row.best_lag_bars) / maxLag) * 100);
  const colour = row.direction === 'peer_leads' ? '#22c55e'
    : row.direction === 'base_leads' ? '#ef4444' : 'var(--text-muted)';

  const leftStyle = row.best_lag_bars < 0 ? { right: '50%', width: `${pct / 2}%` } : null;
  const rightStyle = row.best_lag_bars > 0 ? { left: '50%', width: `${pct / 2}%` } : null;

  return (
    <div className="corr-leadlag-row">
      <div className="corr-leadlag-name">{LABEL[row.peer] || row.peer}</div>
      <div className="corr-leadlag-track">
        <div className="corr-leadlag-center" />
        {leftStyle && <div className="corr-leadlag-bar" style={{ ...leftStyle, background: colour }} />}
        {rightStyle && <div className="corr-leadlag-bar" style={{ ...rightStyle, background: colour }} />}
      </div>
      <div className="corr-leadlag-score" style={{ color: colour }}>
        {row.best_lag_bars > 0 ? '+' : ''}{row.best_lag_bars} · r={row.corr_at_best.toFixed(2)}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// Panel 4 — Heavyweight Divergence Watch
// ══════════════════════════════════════════════════════════════

function Divergence({ base, peers, lookbackDays }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const peerParams = peers.map((p) => `peers=${encodeURIComponent(p)}`).join('&');
      const url = `${API}/divergence?base=${encodeURIComponent(base)}&${peerParams}`
        + `&lookback_days=${lookbackDays}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [base, peers, lookbackDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = useMemo(() => {
    if (!data?.series?.length) return [];
    const byDate = new Map();
    for (const s of data.series) {
      for (const p of s.points) {
        if (!byDate.has(p.date)) byDate.set(p.date, { date: p.date });
        byDate.get(p.date)[s.ticker] = p.cum_pct;
      }
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  return (
    <Panel
      title="Heavyweight Divergence Watch"
      subtitle={`Cumulative % change vs day 0 · last ${lookbackDays} bars`}
      badge={data?.as_of ? `as of ${data.as_of}` : null}
    >
      {loading && <LoadingSkeleton />}
      {err && <div className="corr-error">error: {err}</div>}
      {!loading && !err && data?.status === 'insufficient_data' && (
        <WarmupState data={data} what="Divergence chart" />
      )}
      {!loading && !err && data?.status === 'ok' && chartData.length > 0 && (
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} minTickGap={32} />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickFormatter={(v) => `${v.toFixed(1)}%`}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-panel)', border: '1px solid var(--border)',
                  borderRadius: 6, fontSize: 12,
                }}
                formatter={(v) => `${v.toFixed(2)}%`}
              />
              <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="3 3" />
              {data.series.map((s, i) => (
                <Line
                  key={s.ticker} dataKey={s.ticker} name={LABEL[s.ticker] || s.ticker}
                  stroke={i === 0 ? '#3b82f6' : PEER_COLOURS[(i - 1) % PEER_COLOURS.length]}
                  strokeWidth={i === 0 ? 2.2 : 1.3} dot={false} isAnimationActive={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}


// ══════════════════════════════════════════════════════════════
// Main export
// ══════════════════════════════════════════════════════════════

export default function CorrelationLab() {
  const [windowDays, setWindowDays] = useState(20);
  const [base, setBase] = useState('NIFTY50.NS');
  const [peers, setPeers] = useState(DEFAULT_PEERS);

  const togglePeer = (key) => {
    setPeers((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]);
  };

  return (
    <div className="right-pane corr-lab">
      <div className="right-pane-header">
        <span className="right-pane-label">Correlation Lab</span>
        <span className="corr-footer-tag">Data: warehouse · raw.historical_prices</span>
      </div>

      <div className="right-pane-scroll corr-scroll">
        <div className="corr-controls panel">
          <div className="corr-controls-row">
            <label className="corr-controls-label">Base</label>
            <select
              value={base}
              onChange={(e) => setBase(e.target.value)}
              className="corr-select"
            >
              {UNIVERSE.filter((u) => u.group === 'index' || u.group === 'equity')
                .map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
          </div>
          <div className="corr-controls-row">
            <label className="corr-controls-label">Peers</label>
            <div className="corr-peer-chips">
              {UNIVERSE.filter((u) => u.key !== base).map((u) => (
                <button
                  key={u.key}
                  className={`corr-chip ${peers.includes(u.key) ? 'corr-chip-active' : ''}`}
                  onClick={() => togglePeer(u.key)}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="corr-grid">
          <CorrelationMatrix windowDays={windowDays} onWindowChange={setWindowDays} />
          <RollingCorrelation base={base} peers={peers} windowDays={windowDays} lookbackDays={120} />
          <LeadLag base={base} peers={peers} maxLag={5} windowDays={60} />
          <Divergence base={base} peers={peers} lookbackDays={60} />
        </div>
      </div>
    </div>
  );
}
