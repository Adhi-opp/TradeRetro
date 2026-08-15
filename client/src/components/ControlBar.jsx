import { AlertTriangle, CheckCircle2, Play } from 'lucide-react';
import TickerInput from './TickerInput';
import useBacktestStore from '../store/useBacktestStore';

export default function ControlBar() {
  const ticker = useBacktestStore((s) => s.ticker);
  const startDate = useBacktestStore((s) => s.startDate);
  const endDate = useBacktestStore((s) => s.endDate);
  const capital = useBacktestStore((s) => s.capital);
  const applyCosts = useBacktestStore((s) => s.applyCosts);
  const loading = useBacktestStore((s) => s.loading);
  const error = useBacktestStore((s) => s.error);
  const result = useBacktestStore((s) => s.result);
  const set = useBacktestStore((s) => s.set);
  const toggleCosts = useBacktestStore((s) => s.toggleCosts);
  const runBacktest = useBacktestStore((s) => s.runBacktest);

  return (
    <div className="control-bar-panel">
      {/* 4. Asset Configuration */}
      <div className="cb-section cb-group-asset">
        <div className="cb-group-title">4. Asset & Capital</div>
        <div className="cb-grid-2">
          <div className="cb-field cb-ticker">
            <TickerInput
              label="Select Asset"
              value={ticker}
              onChange={(v) => set({ ticker: v })}
              disabled={loading}
            />
          </div>
          <div className="cb-field">
            <label htmlFor="cb-capital">Initial Capital (INR)</label>
            <input
              id="cb-capital"
              type="number"
              value={capital}
              min="1000"
              step="1000"
              onChange={(e) => set({ capital: e.target.value })}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* 5. Date Range Configuration */}
      <div className="cb-section cb-group-dates">
        <div className="cb-group-title">5. Backtest Period</div>
        <div className="cb-grid-2">
          <div className="cb-field">
            <label htmlFor="cb-start">Lookback Start</label>
            <input
              id="cb-start"
              type="date"
              value={startDate}
              min="2024-04-18"
              onChange={(e) => set({ startDate: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="cb-field">
            <label htmlFor="cb-end">Lookback End</label>
            <input
              id="cb-end"
              type="date"
              value={endDate}
              onChange={(e) => set({ endDate: e.target.value })}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* 6. Execution Area */}
      <div className="cb-section cb-group-execution">
        <div className="cb-group-title">6. Run Backtest</div>
        <div className="cb-execution-row">
          <label className="cost-toggle" title="Apply Indian taxes (STT, brokerage, slippage)">
            <input type="checkbox" checked={applyCosts} onChange={toggleCosts} />
            <span className="cost-toggle-slider" />
            <span className="cost-toggle-label">{applyCosts ? 'Net of costs' : 'Gross'}</span>
          </label>
          <button className="cb-run-btn" onClick={runBacktest} disabled={loading}>
            {loading ? <span className="spinner" /> : <Play size={15} />}
            <span>{loading ? 'Running...' : 'Execute Backtest'}</span>
          </button>
          <div className={`execution-status ${error ? 'error' : result ? 'success' : 'idle'}`} role="status">
            {error ? <AlertTriangle size={14} /> : result ? <CheckCircle2 size={14} /> : <span className="status-dot-soft" />}
            <span>{error ? 'Execution failed' : result ? 'Results ready' : 'Ready to run'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
