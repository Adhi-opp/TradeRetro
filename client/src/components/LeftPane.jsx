import { ShieldAlert, BarChart3, Activity, Loader } from 'lucide-react';
import StrategyForm from './StrategyForm';
import AiVerifyForm from './AiVerifyForm';

export default function LeftPane({
  mode,
  onSwitchMode,
  onRunBacktest,
  onRunMonteCarlo,
  onVerify,
  loading,
  error,
}) {
  const isManual = mode === 'manual';
  const isAi = mode === 'ai';
  const isPipeline = mode === 'pipeline';

  return (
    <div className="left-pane">
      <div className="left-pane-header">
        <span className="left-pane-label">Control Center</span>
        {loading && (
          <span className="left-pane-status">
            <Loader size={12} className="spin-icon" />
            Running...
          </span>
        )}
      </div>

      <div className="left-pane-scroll">
        {/* Loading overlay — locks the form visually */}
        {loading && <div className="left-pane-overlay" />}

        {/* Mode Toggle */}
        <div className="mode-toggle">
          <button
            className={'mode-btn' + (isManual ? ' mode-active' : '')}
            onClick={() => onSwitchMode('manual')}
            disabled={loading}
          >
            <BarChart3 size={14} />
            Manual
          </button>
          <button
            className={'mode-btn mode-btn-ai' + (isAi ? ' mode-active' : '')}
            onClick={() => onSwitchMode('ai')}
            disabled={loading}
          >
            <ShieldAlert size={14} />
            AI Verify
          </button>
          <button
            className={'mode-btn mode-btn-pipeline' + (isPipeline ? ' mode-active' : '')}
            onClick={() => onSwitchMode('pipeline')}
            disabled={loading}
          >
            <Activity size={14} />
            Data Pipeline
          </button>
        </div>

        {/* Form */}
        {isManual ? (
          <StrategyForm onRunBacktest={onRunBacktest} onRunMonteCarlo={onRunMonteCarlo} isLoading={loading} />
        ) : isPipeline ? (
          <div className="form-panel pipeline-mode-panel">
            <div className="form-panel-title">Observability Console</div>
            <p className="pipeline-mode-copy">
              The Grafana pipeline dashboard is embedded directly into TradeRetro so you can monitor
              ingestion, freshness, and orchestration health without leaving the app shell.
            </p>
            <div className="pipeline-mode-hint">
              If the iframe is blank, recreate the `grafana` container and confirm anonymous viewer
              access is enabled.
            </div>
          </div>
        ) : (
          <AiVerifyForm onVerify={onVerify} isLoading={loading} />
        )}

        {/* Error */}
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
}
