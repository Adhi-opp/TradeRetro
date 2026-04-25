import { Loader } from 'lucide-react';
import StrategyForm from './StrategyForm';

export default function LeftPane({
  onRunBacktest,
  onRunMonteCarlo,
  loading,
  error,
}) {
  return (
    <div className="left-pane">
      <div className="left-pane-header">
        <span className="left-pane-label">Strategy Configuration</span>
        {loading && (
          <span className="left-pane-status">
            <Loader size={12} className="spin-icon" />
            Running...
          </span>
        )}
      </div>

      <div className="left-pane-scroll">
        {loading && <div className="left-pane-overlay" />}
        <StrategyForm
          onRunBacktest={onRunBacktest}
          onRunMonteCarlo={onRunMonteCarlo}
          isLoading={loading}
        />
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
}
