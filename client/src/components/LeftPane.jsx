import { ShieldAlert, BarChart3, Loader } from 'lucide-react';
import StrategyForm from './StrategyForm';
import AiVerifyForm from './AiVerifyForm';

export default function LeftPane({
  mode,
  onSwitchMode,
  onRunBacktest,
  onVerify,
  loading,
  error,
  collapsed,
}) {
  const isManual = mode === 'manual';

  return (
    <div className={'left-pane' + (collapsed ? ' left-pane-collapsed' : '')}>
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
            className={'mode-btn mode-btn-ai' + (!isManual ? ' mode-active' : '')}
            onClick={() => onSwitchMode('ai')}
            disabled={loading}
          >
            <ShieldAlert size={14} />
            AI Verify
          </button>
        </div>

        {/* Form */}
        {isManual ? (
          <StrategyForm onRunBacktest={onRunBacktest} isLoading={loading} />
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
