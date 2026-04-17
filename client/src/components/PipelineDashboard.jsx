const DEFAULT_GRAFANA_DASHBOARD_URL =
  'http://localhost:3000/d/pipeline-health/pipeline-health?orgId=1&kiosk=tv';

export default function PipelineDashboard() {
  const dashboardUrl =
    import.meta.env.VITE_GRAFANA_PIPELINE_URL || DEFAULT_GRAFANA_DASHBOARD_URL;

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
