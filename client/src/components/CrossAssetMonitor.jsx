import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Loader, RefreshCw, TrendingUp, TrendingDown, Activity, Eye, Radio,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, ReferenceLine, Legend, Cell,
} from 'recharts';

const LIVE_API = 'http://localhost:8000/api/live';
const CORR_API = 'http://localhost:8000/api/correlation';

// Palette & per-ticker accent — aligned with reference HTML design language
const TICKER_META = {
  'NIFTY50.NS':   { label: 'NIFTY 50',    accent: '#4a9eda', class: 'index' },
  'BANKNIFTY.NS': { label: 'BANK NIFTY',  accent: '#9b72e0', class: 'index' },
  'RELIANCE.NS':  { label: 'RELIANCE',    accent: '#00c9a7', class: 'equity' },
  'HDFCBANK.NS':  { label: 'HDFC BANK',   accent: '#4caf7d', class: 'equity' },
  'ICICIBANK.NS': { label: 'ICICI BANK',  accent: '#e0a040', class: 'equity' },
  'TCS.NS':       { label: 'TCS',         accent: '#00a8cc', class: 'equity' },
  'INFY.NS':      { label: 'INFY',        accent: '#5ad4c4', class: 'equity' },
  'USDINR':       { label: 'USD/INR',     accent: '#f07850', class: 'forex' },
  'CRUDE':        { label: 'CRUDE',       accent: '#e05252', class: 'commodity' },
  'INDIAVIX':     { label: 'INDIA VIX',   accent: '#f0c040', class: 'vol' },
};

const tickerMeta = (sym) => TICKER_META[sym] || { label: sym, accent: '#6b7875', class: 'equity' };

// Compact label for heatmap axes — strips .NS / .BSE suffix, collapses spaces.
// Keeps the symbol intact so "BAJFINANCE" stays "BAJFINANCE" (not "JFINANCE").
const shortLabel = (sym) => (TICKER_META[sym]?.label || sym)
  .replace(/\.(NS|BSE|BO)$/i, '')
  .replace(/\s+/g, '');

const DEFAULT_TICKERS = ['NIFTY50.NS', 'BANKNIFTY.NS', 'RELIANCE.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'USDINR', 'CRUDE'];
const DEFAULT_PEERS = ['RELIANCE.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'TCS.NS', 'INFY.NS'];
const PEER_COLOURS = ['#00c9a7', '#4caf7d', '#e0a040', '#00a8cc', '#9b72e0', '#f07850'];

const fmtNum = (v, d = 2) => {
  if (v == null || Number.isNaN(v)) return '—';
  return Number(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
};

// Chart-axis date formatter: "2025-10-21" → "Oct 21".
// Keeps chronological axes scannable vs. a row of ISO dates that blur together.
const fmtDateTick = (d) => {
  if (!d) return '';
  const [y, m, day] = String(d).split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mi = Number(m) - 1;
  if (Number.isNaN(mi) || mi < 0 || mi > 11) return d;
  return `${months[mi]} ${Number(day)}`;
};

// ─── Reusable Panel shell ─────────────────────────────────────────
function Panel({ title, subtitle, badge, actions, children, className = '' }) {
  return (
    <div className={`ca-panel ${className}`}>
      <div className="ca-panel-header">
        <div className="ca-panel-titleblock">
          <div className="ca-panel-title">{title}</div>
          {subtitle && <div className="ca-panel-subtitle">{subtitle}</div>}
        </div>
        <div className="ca-panel-actions">
          {actions}
          {badge != null && <span className="ca-panel-badge">{badge}</span>}
        </div>
      </div>
      <div className="ca-panel-body">{children}</div>
    </div>
  );
}

// ─── Live ticker row with accent-bordered cards ───────────────────
function LiveTickerRow({ refreshSignal }) {
  const [quotes, setQuotes] = useState([]);
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = DEFAULT_TICKERS.map((s) => `symbols=${encodeURIComponent(s)}`).join('&');
      const r = await fetch(`${LIVE_API}/quotes?${params}`);
      if (!r.ok) {
        setApiError(`Live API ${r.status}`);
        setQuotes([]);
        return;
      }
      const d = await r.json();
      setQuotes(d.quotes || []);
      setApiError(null);
    } catch (e) {
      setApiError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
    const iv = setInterval(fetchQuotes, 15000);
    return () => clearInterval(iv);
  }, [fetchQuotes, refreshSignal]);

  if (apiError) {
    return (
      <div className="ticker-strip ticker-strip-error">
        <AlertCircle size={14} /> {apiError} · is the Python API up on :8000?
      </div>
    );
  }

  return (
    <div className="ticker-strip">
      {quotes.map((q) => {
        const meta = tickerMeta(q.symbol);
        const hasData = q.last != null && q.change_pct != null;
        const up = hasData && q.change_pct >= 0;
        return (
          <div
            key={q.symbol}
            className={`ticker-card ${hasData ? (up ? 'up' : 'down') : 'stale'}`}
            style={{ '--accent': meta.accent }}
          >
            <div className="ticker-card-top">
              <span className="ticker-symbol">{meta.label}</span>
              <span className="ticker-class">{meta.class}</span>
            </div>
            <div className="ticker-price">
              {hasData ? fmtNum(q.last) : <span className="ticker-stale">no data</span>}
            </div>
            <div className={`ticker-change ${up ? 'up' : 'down'}`}>
              {hasData
                ? <>{up ? '▲' : '▼'} {up ? '+' : ''}{q.change_pct.toFixed(2)}%</>
                : <>—</>}
            </div>
          </div>
        );
      })}
      {quotes.length === 0 && !loading && (
        <div className="ticker-empty">No quotes · backfill warehouse first</div>
      )}
    </div>
  );
}

// ─── VIX gauge + regime ───────────────────────────────────────────
function VIXPanel({ refreshSignal }) {
  const [vix, setVix] = useState(null);
  const [status, setStatus] = useState('loading');
  const [reason, setReason] = useState(null);

  const fetchVix = useCallback(async () => {
    try {
      const r = await fetch(`${LIVE_API}/vix`);
      if (!r.ok) { setStatus('error'); setReason(`HTTP ${r.status}`); return; }
      const d = await r.json();
      if (d.status === 'ok') { setVix(d); setStatus('ok'); }
      else { setStatus('no_data'); setReason(d.reason || 'INDIAVIX not backfilled'); }
    } catch (e) {
      setStatus('error'); setReason(e.message);
    }
  }, []);

  useEffect(() => {
    fetchVix();
    const iv = setInterval(fetchVix, 30000);
    return () => clearInterval(iv);
  }, [fetchVix, refreshSignal]);

  if (status === 'loading') {
    return (
      <Panel title="India VIX" subtitle="Volatility regime">
        <div className="ca-empty"><Loader size={14} className="spin-icon" /> Loading VIX…</div>
      </Panel>
    );
  }

  if (status !== 'ok') {
    return (
      <Panel title="India VIX" subtitle="Volatility regime" badge={status === 'error' ? 'error' : 'no data'}>
        <div className="ca-empty ca-empty-warn">
          <AlertCircle size={18} />
          <div className="ca-empty-title">
            {status === 'error' ? 'Live API unreachable' : 'VIX not backfilled'}
          </div>
          <div className="ca-empty-desc">{reason}</div>
        </div>
      </Panel>
    );
  }

  const pct = Math.min(100, (vix.vix / 40) * 100);
  const regimeColour = { low: '#4caf7d', normal: '#4a9eda', elevated: '#e0a040', high: '#e05252' }[vix.regime_code];
  const changeUp = vix.change_pct >= 0;

  return (
    <Panel
      title="India VIX"
      subtitle={`As of ${vix.as_of}`}
      badge={<span className="regime-badge" style={{ color: regimeColour, borderColor: regimeColour }}>{vix.regime}</span>}
    >
      <div className="vix-panel">
        <div className="vix-primary">
          <div className="vix-value" style={{ color: regimeColour }}>{vix.vix.toFixed(2)}</div>
          <div className={`vix-delta ${changeUp ? 'up' : 'down'}`}>
            {changeUp ? '▲' : '▼'} {changeUp ? '+' : ''}{vix.change_pct.toFixed(2)}% vs prev
          </div>
        </div>
        <div className="vix-gauge-track">
          <div className="vix-gauge-bar" style={{ width: `${pct}%`, background: regimeColour }} />
          <div className="vix-gauge-marker" style={{ left: `${pct}%`, background: regimeColour }} />
        </div>
        <div className="vix-gauge-scale">
          <span>0</span><span>10</span><span>20</span><span>30</span><span>40+</span>
        </div>
        <div className="vix-regime-bands">
          {[
            { label: 'Low', range: '<13', color: '#4caf7d' },
            { label: 'Normal', range: '13–20', color: '#4a9eda' },
            { label: 'Elevated', range: '20–28', color: '#e0a040' },
            { label: 'High', range: '>28', color: '#e05252' },
          ].map((b) => (
            <div
              key={b.label}
              className={`regime-pill ${b.label === vix.regime ? 'active' : ''}`}
              style={{ '--pill': b.color }}
            >
              <div className="regime-pill-top">{b.label}</div>
              <div className="regime-pill-range">{b.range}</div>
            </div>
          ))}
        </div>
        <div className="vix-advice">
          <Activity size={12} /> {vix.advice}
        </div>
      </div>
    </Panel>
  );
}

// ─── Macro signal feed ────────────────────────────────────────────
function SignalFeed({ refreshSignal }) {
  const [signals, setSignals] = useState([]);
  const [reason, setReason] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${LIVE_API}/signals`);
      if (!r.ok) { setReason(`Live API ${r.status}`); setSignals([]); return; }
      const d = await r.json();
      setSignals(d.signals || []);
      setReason(d.reason || null);
    } catch (e) {
      setReason(e.message); setSignals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
    const iv = setInterval(fetchSignals, 30000);
    return () => clearInterval(iv);
  }, [fetchSignals, refreshSignal]);

  return (
    <Panel
      title="Macro Signal Feed"
      subtitle="Cross-asset alerts computed from latest EOD"
      badge={signals.length}
      actions={<button className="icon-btn" onClick={fetchSignals} title="Refresh"><RefreshCw size={13} className={loading ? 'spin-icon' : ''} /></button>}
    >
      <div className="ca-signal-list">
        {signals.length === 0 && (
          <div className="ca-empty">{reason ? `No signals · ${reason}` : 'Scanning…'}</div>
        )}
        {signals.map((s, i) => {
          const Icon = s.severity === 'bull' ? TrendingUp
            : s.severity === 'bear' ? TrendingDown
            : s.severity === 'warning' ? AlertCircle
            : Eye;
          return (
            <div key={i} className={`ca-signal-item ca-sev-${s.severity}`}>
              <div className="ca-signal-icon"><Icon size={14} /></div>
              <div className="ca-signal-body">
                <div className="ca-signal-title">{s.title}</div>
                <div className="ca-signal-desc">{s.desc}</div>
                <div className="ca-signal-time">{new Date(s.as_of).toLocaleDateString('en-IN')}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ─── Price chart panel (one per chosen symbol) ────────────────────
function PriceChartPanel({ symbol, refreshSignal }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lookback, setLookback] = useState(60);
  const [error, setError] = useState(null);
  const meta = tickerMeta(symbol);

  const fetchPrices = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${LIVE_API}/prices/${encodeURIComponent(symbol)}?lookback_days=${lookback}`);
      if (!r.ok) {
        setError(r.status === 404 ? 'No data in warehouse' : `HTTP ${r.status}`);
        setData([]);
        return;
      }
      const d = await r.json();
      setData(d.points || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [symbol, lookback]);

  useEffect(() => { fetchPrices(); }, [fetchPrices, refreshSignal]);

  const last = data.length ? data[data.length - 1].close : null;
  const first = data.length ? data[0].close : null;
  const delta = last && first ? ((last - first) / first) * 100 : 0;
  const up = delta >= 0;
  const gradId = `grad-${symbol.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <Panel
      title={meta.label}
      subtitle={`${lookback}-day close · ${symbol}`}
      actions={
        <div className="chip-group">
          {[30, 60, 120, 250].map((d) => (
            <button
              key={d}
              className={`chip ${d === lookback ? 'chip-active' : ''}`}
              onClick={() => setLookback(d)}
            >
              {d}d
            </button>
          ))}
        </div>
      }
    >
      <div className="chart-summary">
        <div className="chart-summary-last" style={{ color: meta.accent }}>{fmtNum(last)}</div>
        <div className={`chart-summary-delta ${up ? 'up' : 'down'}`}>
          {up ? '▲' : '▼'} {up ? '+' : ''}{delta.toFixed(2)}% <span className="muted">/ period</span>
        </div>
      </div>
      {loading && <div className="ca-empty"><Loader size={14} className="spin-icon" /> Loading…</div>}
      {!loading && error && <div className="ca-empty ca-empty-warn"><AlertCircle size={14} /> {error}</div>}
      {!loading && !error && data.length > 0 && (
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={meta.accent} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={meta.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border-soft)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} minTickGap={48} axisLine={false} tickLine={false} tickFormatter={fmtDateTick} />
              <YAxis
                domain={['dataMin', 'dataMax']}
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={(v) => v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              />
              <Tooltip
                contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                formatter={(v) => v?.toFixed(2)}
                labelStyle={{ color: 'var(--text-secondary)' }}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={meta.accent}
                strokeWidth={1.75}
                fillOpacity={1}
                fill={`url(#${gradId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

// ─── Correlation matrix ───────────────────────────────────────────
function CorrelationMatrixPanel({ windowDays, onWindowChange, refreshSignal }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${CORR_API}/matrix?window_days=${windowDays}`);
      if (r.ok) setData(await r.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => { fetchMatrix(); }, [fetchMatrix, refreshSignal]);

  return (
    <Panel
      title="Correlation Matrix"
      subtitle={`Pearson on log-returns · ${windowDays}d window${data?.n_samples ? ` · ${data.n_samples} obs` : ''}`}
      actions={
        <div className="chip-group">
          {[10, 20, 60].map((w) => (
            <button
              key={w}
              className={`chip ${w === windowDays ? 'chip-active' : ''}`}
              onClick={() => onWindowChange(w)}
            >
              {w}d
            </button>
          ))}
        </div>
      }
    >
      {loading && <div className="ca-empty"><Loader size={14} className="spin-icon" /> Loading…</div>}
      {!loading && data?.status !== 'ok' && (
        <div className="ca-empty ca-empty-warn">
          <AlertCircle size={14} /> {data?.reason || 'Insufficient data in warehouse'}
        </div>
      )}
      {!loading && data?.status === 'ok' && (
        <CorrelationHeatmap tickers={data.tickers} matrix={data.matrix} />
      )}
    </Panel>
  );
}

function CorrelationHeatmap({ tickers, matrix }) {
  const n = tickers.length;
  const cellSize = n > 10 ? 36 : 44;
  const rowLabelWidth = 96;
  const headerHeight = 92;
  const corrBg = (x) => {
    if (x == null || Number.isNaN(x)) return 'rgba(107,120,117,0.08)';
    const a = Math.max(-1, Math.min(1, x));
    const intensity = 0.12 + Math.abs(a) * 0.65;
    return a >= 0
      ? `rgba(0, 201, 167, ${intensity})`
      : `rgba(224, 82, 82, ${intensity})`;
  };
  return (
    <div className="ca-corr-scroll">
      <div
        className="ca-corr-grid"
        style={{
          gridTemplateColumns: `${rowLabelWidth}px repeat(${n}, ${cellSize}px)`,
          gridTemplateRows: `${headerHeight}px repeat(${n}, ${cellSize}px)`,
        }}
      >
        <div className="ca-corr-corner" />
        {tickers.map((t) => (
          <div key={`h-${t}`} className="ca-corr-header" title={t}>{shortLabel(t)}</div>
        ))}
        {tickers.map((row, ri) => (
          <MatrixRow key={`r-${row}`} row={row} ri={ri} tickers={tickers} matrix={matrix} bgOf={corrBg} />
        ))}
      </div>
      <div className="ca-corr-legend">
        <span className="ca-corr-legend-swatch" style={{ background: 'rgba(224, 82, 82, 0.6)' }} />
        <span>-1</span>
        <span className="ca-corr-legend-swatch" style={{ background: 'rgba(107,120,117,0.15)' }} />
        <span>0</span>
        <span className="ca-corr-legend-swatch" style={{ background: 'rgba(0, 201, 167, 0.6)' }} />
        <span>+1</span>
      </div>
    </div>
  );
}

function MatrixRow({ row, ri, tickers, matrix, bgOf }) {
  return (
    <>
      <div className="ca-corr-rowlabel" title={row}>{shortLabel(row)}</div>
      {tickers.map((col, ci) => {
        const v = matrix[ri][ci];
        return (
          <div
            key={`c-${row}-${col}`}
            className="ca-corr-cell"
            style={{ background: bgOf(v), color: Math.abs(v) > 0.45 ? '#fff' : 'var(--text-primary)' }}
            title={`${row} vs ${col}: ${v?.toFixed(3)}`}
          >
            {v == null ? '·' : v.toFixed(2)}
          </div>
        );
      })}
    </>
  );
}

// ─── Rolling correlation over time ────────────────────────────────
function RollingCorrPanel({ refreshSignal }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [window, setWindow] = useState(20);

  const fetchRolling = useCallback(async () => {
    setLoading(true);
    try {
      const peerParams = DEFAULT_PEERS.map((p) => `peers=${encodeURIComponent(p)}`).join('&');
      const r = await fetch(`${CORR_API}/rolling?base=NIFTY50.NS&${peerParams}&window_days=${window}&lookback_days=120`);
      if (r.ok) setData(await r.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => { fetchRolling(); }, [fetchRolling, refreshSignal]);

  // Merge per-peer series into a single wide-format array keyed by date
  const chartData = useMemo(() => {
    if (!data?.series?.length) return [];
    const byDate = new Map();
    data.series.forEach((s) => {
      s.points.forEach((p) => {
        if (!byDate.has(p.date)) byDate.set(p.date, { date: p.date });
        byDate.get(p.date)[s.peer] = p.corr;
      });
    });
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const peers = data?.series?.map((s) => s.peer) || [];

  return (
    <Panel
      title="Rolling Correlation vs NIFTY 50"
      subtitle={`${window}-day rolling window · last 120 bars`}
      actions={
        <div className="chip-group">
          {[10, 20, 60].map((w) => (
            <button key={w} className={`chip ${w === window ? 'chip-active' : ''}`} onClick={() => setWindow(w)}>{w}d</button>
          ))}
        </div>
      }
    >
      {loading && <div className="ca-empty"><Loader size={14} className="spin-icon" /> Loading…</div>}
      {!loading && data?.status !== 'ok' && (
        <div className="ca-empty ca-empty-warn"><AlertCircle size={14} /> {data?.reason || 'Insufficient data'}</div>
      )}
      {!loading && data?.status === 'ok' && chartData.length > 0 && (
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="var(--border-soft)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} minTickGap={48} axisLine={false} tickLine={false} tickFormatter={fmtDateTick} />
              <YAxis domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={36} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                formatter={(v) => v?.toFixed(3)}
              />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="plainline" />
              {peers.map((p, i) => (
                <Line
                  key={p}
                  type="monotone"
                  dataKey={p}
                  name={tickerMeta(p).label}
                  stroke={tickerMeta(p).accent || PEER_COLOURS[i % PEER_COLOURS.length]}
                  strokeWidth={1.6}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

// ─── Lead-Lag proxy (bar chart) ───────────────────────────────────
function LeadLagPanel({ refreshSignal }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchLL = useCallback(async () => {
    setLoading(true);
    try {
      const peerParams = DEFAULT_PEERS.map((p) => `peers=${encodeURIComponent(p)}`).join('&');
      const r = await fetch(`${CORR_API}/leadlag?base=NIFTY50.NS&${peerParams}&max_lag=5&window_days=60`);
      if (r.ok) setData(await r.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLL(); }, [fetchLL, refreshSignal]);

  const rows = (data?.results || []).map((r) => ({
    peer: tickerMeta(r.peer).label,
    lag: r.best_lag_bars,
    corr: r.corr_at_best,
    direction: r.direction,
    accent: tickerMeta(r.peer).accent,
  }));

  return (
    <Panel
      title="Lead-Lag Profile vs NIFTY 50"
      subtitle="Best-lag Pearson · positive ⇒ peer leads base"
      badge={rows.length ? `±5 bars` : null}
    >
      {loading && <div className="ca-empty"><Loader size={14} className="spin-icon" /> Loading…</div>}
      {!loading && data?.status !== 'ok' && (
        <div className="ca-empty ca-empty-warn"><AlertCircle size={14} /> {data?.reason || 'Insufficient data'}</div>
      )}
      {!loading && data?.status === 'ok' && rows.length > 0 && (
        <>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }} layout="vertical">
                <CartesianGrid stroke="var(--border-soft)" strokeDasharray="2 4" horizontal={false} />
                <XAxis type="number" domain={[-5, 5]} ticks={[-5, -2, 0, 2, 5]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="peer" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={90} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                  formatter={(v, k, p) => [`lag=${v} · corr=${p?.payload?.corr?.toFixed(3)}`, p?.payload?.direction]}
                />
                <ReferenceLine x={0} stroke="var(--border)" />
                <Bar dataKey="lag" isAnimationActive={false}>
                  {rows.map((r, i) => (
                    <Cell key={i} fill={r.accent} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="ll-disclaimer">
            <Radio size={11} /> Lagged-correlation proxy · not true Granger causality
          </div>
        </>
      )}
    </Panel>
  );
}

// ─── Heavyweight divergence (normalized cumulative %) ─────────────
function DivergencePanel({ refreshSignal }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lookback, setLookback] = useState(60);

  const fetchDiv = useCallback(async () => {
    setLoading(true);
    try {
      const peerParams = DEFAULT_PEERS.map((p) => `peers=${encodeURIComponent(p)}`).join('&');
      const r = await fetch(`${CORR_API}/divergence?base=NIFTY50.NS&${peerParams}&lookback_days=${lookback}`);
      if (r.ok) setData(await r.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [lookback]);

  useEffect(() => { fetchDiv(); }, [fetchDiv, refreshSignal]);

  const chartData = useMemo(() => {
    if (!data?.series?.length) return [];
    const byDate = new Map();
    data.series.forEach((s) => {
      s.points.forEach((p) => {
        if (!byDate.has(p.date)) byDate.set(p.date, { date: p.date });
        byDate.get(p.date)[s.ticker] = p.cum_pct;
      });
    });
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const tickers = data?.series?.map((s) => s.ticker) || [];

  return (
    <Panel
      title="Heavyweight Divergence"
      subtitle={`Normalized cumulative % vs start · last ${lookback} bars`}
      actions={
        <div className="chip-group">
          {[30, 60, 120].map((d) => (
            <button key={d} className={`chip ${d === lookback ? 'chip-active' : ''}`} onClick={() => setLookback(d)}>{d}d</button>
          ))}
        </div>
      }
    >
      {loading && <div className="ca-empty"><Loader size={14} className="spin-icon" /> Loading…</div>}
      {!loading && data?.status !== 'ok' && (
        <div className="ca-empty ca-empty-warn"><AlertCircle size={14} /> {data?.reason || 'Insufficient data'}</div>
      )}
      {!loading && data?.status === 'ok' && chartData.length > 0 && (
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="var(--border-soft)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} minTickGap={48} axisLine={false} tickLine={false} tickFormatter={fmtDateTick} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={40} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                formatter={(v) => `${v?.toFixed(2)}%`}
              />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="plainline" />
              {tickers.map((t, i) => (
                <Line
                  key={t}
                  type="monotone"
                  dataKey={t}
                  name={tickerMeta(t).label}
                  stroke={tickerMeta(t).accent || PEER_COLOURS[i % PEER_COLOURS.length]}
                  strokeWidth={t === 'NIFTY50.NS' ? 2.25 : 1.4}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export default function CrossAssetMonitor() {
  const [corrWindow, setCorrWindow] = useState(20);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [lastSync, setLastSync] = useState(new Date());

  const handleRefreshAll = () => {
    setRefreshSignal((n) => n + 1);
    setLastSync(new Date());
  };

  useEffect(() => {
    const iv = setInterval(() => setLastSync(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="ca-monitor">
      <div className="ca-hero">
        <div className="ca-hero-left">
          <h1>Cross-Asset Monitor</h1>
          <span className="ca-hero-sub">Live EOD quotes · volatility regime · correlation analytics</span>
        </div>
        <div className="ca-hero-right">
          <div className="ca-hero-sync">
            <span className="ca-sync-dot" />
            Last sync {lastSync.toLocaleTimeString('en-IN', { hour12: false })}
          </div>
          <button className="ca-refresh-btn" onClick={handleRefreshAll}>
            <RefreshCw size={13} /> Refresh all
          </button>
        </div>
      </div>

      <LiveTickerRow refreshSignal={refreshSignal} />

      <div className="ca-grid-12">
        <div className="ca-span-4"><VIXPanel refreshSignal={refreshSignal} /></div>
        <div className="ca-span-8"><SignalFeed refreshSignal={refreshSignal} /></div>
      </div>

      <div className="ca-grid-12">
        <div className="ca-span-6"><PriceChartPanel symbol="NIFTY50.NS" refreshSignal={refreshSignal} /></div>
        <div className="ca-span-6"><PriceChartPanel symbol="BANKNIFTY.NS" refreshSignal={refreshSignal} /></div>
      </div>

      <div className="ca-grid-12">
        <div className="ca-span-6">
          <CorrelationMatrixPanel windowDays={corrWindow} onWindowChange={setCorrWindow} refreshSignal={refreshSignal} />
        </div>
        <div className="ca-span-6"><RollingCorrPanel refreshSignal={refreshSignal} /></div>
      </div>

      <div className="ca-grid-12">
        <div className="ca-span-6"><LeadLagPanel refreshSignal={refreshSignal} /></div>
        <div className="ca-span-6"><DivergencePanel refreshSignal={refreshSignal} /></div>
      </div>
    </div>
  );
}
