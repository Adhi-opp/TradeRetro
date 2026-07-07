const GRAFANA_BASE_URL =
  import.meta.env.VITE_GRAFANA_PIPELINE_URL ||
  'http://localhost:3000/d/pipeline-health/pipeline-health';

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
        <div className="panel pipeline-dashboard-panel">
          <div className="panel-title">Live Infrastructure Telemetry</div>
          <div className="pipeline-dashboard-frame">
            <iframe
              src={dashboardUrl}
              width="100%"
              height="100%"
              frameBorder="0"
              title="Grafana Pipeline Health"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
