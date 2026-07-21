import { Activity, AlertTriangle, CheckCircle2, Clock3, Cpu, Database, GitBranch, RadioTower, RefreshCw, Server, Zap } from 'lucide-react';

const GRAFANA_BASE_URL =
  import.meta.env.VITE_GRAFANA_PIPELINE_URL ||
  'http://localhost:3000/d/pipeline-health/pipeline-health';

function InfraMetric({ icon: Icon, label, value, hint, tone = 'neutral' }) {
  return (
    <div className={`infra-card infra-card-${tone}`}>
      <div className="infra-card-top">
        <span className="infra-icon"><Icon size={16} /></span>
        <span className="infra-label">{label}</span>
      </div>
      <div className="infra-value">{value}</div>
      <div className="infra-hint">{hint}</div>
    </div>
  );
}

function SkeletonChart({ title, lines = 4 }) {
  return (
    <div className="infra-panel">
      <div className="infra-panel-head">
        <span>{title}</span>
        <span className="infra-live-chip">Live</span>
      </div>
      <div className="infra-chart-skeleton" aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <span key={i} style={{ '--h': `${28 + i * 13}%`, '--d': `${i * 80}ms` }} />
        ))}
      </div>
    </div>
  );
}

export default function PipelineDashboard({ theme = 'dark' }) {
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
          <button className="ca-refresh-btn" onClick={() => window.location.reload()} title="Refresh telemetry">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div className="infra-grid">
          <InfraMetric icon={CheckCircle2} label="Health" value="Watching" hint="Grafana + ingestion views" tone="good" />
          <InfraMetric icon={Clock3} label="Latency" value="< 30s" hint="Target live tick delay" tone="info" />
          <InfraMetric icon={Server} label="Nodes" value="5" hint="FastAPI, Redis, DB, Prefect, Grafana" />
          <InfraMetric icon={Zap} label="Processing" value="EOD + live" hint="Bronze to gold pipeline" tone="warn" />
        </div>

        <div className="infra-layout">
          <SkeletonChart title="Throughput" lines={8} />
          <SkeletonChart title="Latency Distribution" lines={6} />
          <div className="infra-panel infra-status-panel">
            <div className="infra-panel-head">
              <span>Service Status</span>
              <span className="infra-live-chip">Polling</span>
            </div>
            <div className="infra-status-list">
              <div><RadioTower size={14} /><span>Market feed</span><strong>Standby</strong></div>
              <div><Database size={14} /><span>TimescaleDB</span><strong>Observed</strong></div>
              <div><GitBranch size={14} /><span>Prefect flows</span><strong>Scheduled</strong></div>
              <div><Cpu size={14} /><span>Backtest engine</span><strong>Ready</strong></div>
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
