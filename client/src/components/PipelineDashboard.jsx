import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Cpu, Database, GitBranch, RadioTower, RefreshCw, Zap } from 'lucide-react';
import { getHealth, getPipelineHealth } from '../services/pipelineService';

const POLL_INTERVAL_MS = 30000;

const GRAFANA_BASE_URL =
  import.meta.env.VITE_GRAFANA_PIPELINE_URL ||
  'http://localhost:3000/d/pipeline-health/pipeline-health';

const NOT_REPORTED = 'Not reported';

function formatNumber(value) {
  return Number(value).toLocaleString('en-US');
}

function InfraMetric({ icon, label, value, hint, tone = 'neutral', muted = false }) {
  const Icon = icon;
  return (
    <div className={`infra-card infra-card-${tone}`}>
      <div className="infra-card-top">
        <span className="infra-icon"><Icon size={16} /></span>
        <span className="infra-label">{label}</span>
      </div>
      <div className={`infra-value${muted ? ' infra-value-muted' : ''}`}>{value}</div>
      <div className="infra-hint">{hint}</div>
    </div>
  );
}

function SkeletonChart({ title, note, lines = 4 }) {
  return (
    <div className="infra-panel">
      <div className="infra-panel-head">
        <span>{title}</span>
        <span className="infra-live-chip muted">Not reported</span>
      </div>
      <div className="infra-chart-skeleton" aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <span key={i} style={{ '--h': `${28 + i * 13}%`, '--d': `${i * 80}ms` }} />
        ))}
      </div>
      <div className="infra-chart-note">{note}</div>
    </div>
  );
}

function usePipelineTelemetry() {
  const [state, setState] = useState({
    phase: 'loading', // 'loading' | 'ready'
    health: null,
    healthError: false,
    pipeline: null,
    pipelineError: false,
    lastUpdated: null,
  });
  const refreshRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    const controllers = new Set();

    let inFlight = false;

    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        // Each poll cycle gets its own AbortController. Only one cycle may be
        // in flight at a time — if the 30s interval (or a manual Refresh)
        // fires while a previous cycle is still running, that trigger is
        // skipped rather than starting a concurrent request. In-flight
        // requests are never aborted by a new trigger: GET /api/health/pipeline
        // is slow (heavy medallion aggregation) and aborting it every 30s
        // would starve it permanently. Results apply last-write-wins; only
        // unmount (and the StrictMode remount) aborts requests.
        const controller = new AbortController();
        controllers.add(controller);
        const signal = controller.signal;

        const [healthResult, pipelineResult] = await Promise.allSettled([
          getHealth({ signal }),
          getPipelineHealth({ signal, timeoutMs: 120000 }),
        ]);

        controllers.delete(controller);
        if (disposed || controller.signal.aborted) return;

        setState({
          phase: 'ready',
          health: healthResult.status === 'fulfilled' ? healthResult.value : null,
          healthError: healthResult.status === 'rejected',
          pipeline: pipelineResult.status === 'fulfilled' ? pipelineResult.value : null,
          pipelineError: pipelineResult.status === 'rejected',
          lastUpdated: new Date(),
        });
      } finally {
        inFlight = false;
      }
    };

    refreshRef.current = load;
    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      clearInterval(timer);
      for (const c of controllers) c.abort();
      controllers.clear();
      refreshRef.current = null;
    };
  }, []);

  const refresh = useCallback(() => {
    refreshRef.current?.();
  }, []);

  return { ...state, refresh };
}

export default function PipelineDashboard({ theme = 'dark' }) {
  const { phase, health, healthError, pipeline, pipelineError, lastUpdated, refresh } = usePipelineTelemetry();

  // `kiosk` (no value) hides all Grafana chrome on Grafana 10+;
  // the old `kiosk=tv` mode was removed. 30-day window so the EOD
  // pipeline panels (one run/day) actually have data to show.
  const params = new URLSearchParams({
    orgId: '1',
    from: 'now-30d',
    to: 'now',
    refresh: '30s',
    theme,
  });
  const dashboardUrl = `${GRAFANA_BASE_URL}?${params.toString()}&kiosk`;

  const awaiting = phase === 'loading';
  const healthOk = phase === 'ready' && !healthError;
  const pipelineOk = phase === 'ready' && !pipelineError;

  // ── Cards ────────────────────────────────────────────────────
  const healthStatus = health?.status;
  const healthCard = awaiting
    ? { value: '—', tone: 'neutral', muted: true }
    : !healthOk
      ? { value: 'Unavailable', tone: 'error', muted: true }
      : healthStatus
        ? {
            value: healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1),
            tone: healthStatus === 'healthy' ? 'good' : healthStatus === 'degraded' ? 'warn' : 'error',
            muted: false,
          }
        : { value: NOT_REPORTED, tone: 'neutral', muted: true };

  const databaseState = healthOk ? health.database : null;
  const databaseCard = awaiting
    ? { value: '—', tone: 'neutral', muted: true }
    : !healthOk
      ? { value: 'Unavailable', tone: 'error', muted: true }
      : databaseState === 'connected'
        ? { value: 'Connected', tone: 'good', muted: false }
        : databaseState === 'disconnected'
          ? { value: 'Disconnected', tone: 'error', muted: false }
          : { value: NOT_REPORTED, tone: 'neutral', muted: true };

  const redisState = healthOk ? health.redis : null;
  const redisCard = awaiting
    ? { value: '—', tone: 'neutral', muted: true }
    : !healthOk
      ? { value: 'Unavailable', tone: 'error', muted: true }
      : redisState === 'connected'
        ? { value: 'Connected', tone: 'good', muted: false }
        : redisState === 'disconnected'
          ? { value: 'Disconnected', tone: 'error', muted: false }
          : { value: NOT_REPORTED, tone: 'neutral', muted: true };

  const ticksPerMinute = pipelineOk ? pipeline?.bronze?.ticks_per_minute : null;
  const tickCard = awaiting
    ? { value: '—', tone: 'neutral', muted: true }
    : !pipelineOk
      ? { value: 'Unavailable', tone: 'error', muted: true }
      : ticksPerMinute !== null && ticksPerMinute !== undefined
        ? { value: `${formatNumber(ticksPerMinute)} ticks/min`, tone: 'info', muted: false }
        : { value: NOT_REPORTED, tone: 'neutral', muted: true };

  // ── Status rows ──────────────────────────────────────────────
  const redisSymbols = pipelineOk ? pipeline?.redis_latest_symbols : null;
  const feedRow = awaiting
    ? { value: '—', cls: 'status-neutral' }
    : !pipelineOk
      ? { value: 'Unavailable', cls: 'status-neutral' }
      : redisSymbols !== null && redisSymbols !== undefined
        ? { value: `${formatNumber(redisSymbols)} symbols`, cls: 'status-ok' }
        : { value: NOT_REPORTED, cls: 'status-neutral' };

  const bronze = pipelineOk ? pipeline?.bronze : null;
  const dbRow = awaiting
    ? { value: '—', cls: 'status-neutral' }
    : !pipelineOk
      ? { value: 'Unavailable', cls: 'status-neutral' }
      : bronze?.rows !== null && bronze?.rows !== undefined
        ? {
            value: `${formatNumber(bronze.rows)} ticks`,
            cls: 'status-ok',
            hint: `${bronze.instruments ?? 0} instruments · bronze.market_ticks`,
          }
        : { value: NOT_REPORTED, cls: 'status-neutral' };

  const unsupportedRow = awaiting
    ? { value: '—', cls: 'status-neutral' }
    : !healthOk
      ? { value: 'Unavailable', cls: 'status-neutral' }
      : { value: NOT_REPORTED, cls: 'status-neutral' };

  return (
    <div className="right-pane">
      <div className="right-pane-header">
        <span className="right-pane-label">Pipeline Telemetry</span>
      </div>

      <div className="right-pane-scroll pipeline-dashboard-shell">
        <div className="pipeline-hero">
          <div>
            <span className="engine-eyebrow">Infrastructure</span>
            <h1>Pipeline Operations</h1>
            <p>Warehouse ingestion, scheduler health, processing latency, and telemetry readiness.</p>
          </div>
          <div className="pipeline-hero-actions">
            <span className="infra-updated mono">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : ''}
            </span>
            <button className="ca-refresh-btn" onClick={refresh} title="Refresh telemetry">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        <div className="infra-grid">
          <InfraMetric icon={CheckCircle2} label="Health" value={healthCard.value} hint="Backend status · GET /api/health" tone={healthCard.tone} muted={healthCard.muted} />
          <InfraMetric icon={Database} label="Database" value={databaseCard.value} hint="TimescaleDB · GET /api/health" tone={databaseCard.tone} muted={databaseCard.muted} />
          <InfraMetric icon={RadioTower} label="Redis" value={redisCard.value} hint="Stream broker · GET /api/health" tone={redisCard.tone} muted={redisCard.muted} />
          <InfraMetric icon={Zap} label="Tick Rate" value={tickCard.value} hint="bronze.market_ticks · last 60 s" tone={tickCard.tone} muted={tickCard.muted} />
        </div>

        <div className="infra-layout">
          <SkeletonChart title="Throughput" note="No backend endpoint reports throughput — chart intentionally not populated." lines={8} />
          <SkeletonChart title="Latency Distribution" note="No backend endpoint reports latency percentiles — not measured." lines={6} />
          <div className="infra-panel infra-status-panel">
            <div className="infra-panel-head">
              <span>Service Status</span>
              <span className="infra-live-chip">Polling 30s</span>
            </div>
            <div className="infra-status-list">
              <div><RadioTower size={14} /><span>Market feed</span><strong className={feedRow.cls}>{feedRow.value}</strong></div>
              <div><Clock3 size={14} /><span>TimescaleDB</span><strong className={dbRow.cls}>{dbRow.value}</strong></div>
              <div><GitBranch size={14} /><span>Prefect flows</span><strong className={unsupportedRow.cls}>{unsupportedRow.value}</strong></div>
              <div><Cpu size={14} /><span>Backtest engine</span><strong className={unsupportedRow.cls}>{unsupportedRow.value}</strong></div>
            </div>
          </div>
          <div className="infra-panel infra-alert-panel">
            <div className="infra-panel-head">
              <span>Operational Notes</span>
              <span className="infra-live-chip muted">Read-only</span>
            </div>
            <div className="infra-empty-state">
              <AlertTriangle size={22} />
              <strong>External telemetry may be unavailable</strong>
              <span>The embedded Grafana panel below remains the source of truth when the observability stack is online.</span>
            </div>
          </div>
        </div>

        <div className="panel pipeline-dashboard-panel">
          <div className="panel-title-row">
            <span className="panel-title"><Activity size={15} /> Live Grafana Telemetry</span>
            <span className="panel-sub">30 day window · auto refresh 30s</span>
          </div>
          <div className="pipeline-dashboard-frame">
            <iframe
              src={dashboardUrl}
              width="100%"
              height="100%"
              frameBorder="0"
              title="Grafana Pipeline Health"
              loading="lazy"
            />
            <div className="pipeline-frame-fallback">
              <Database size={22} />
              <strong>Telemetry frame loading</strong>
              <span>If Grafana is offline, this panel will stay empty while the operational cards above remain available.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}