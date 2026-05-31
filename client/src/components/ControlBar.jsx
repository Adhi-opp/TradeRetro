import { Play } from 'lucide-react';
import TickerInput from './TickerInput';
import useBacktestStore from '../store/useBacktestStore';

export default function ControlBar() {
  const ticker = useBacktestStore((s) => s.ticker);
  const startDate = useBacktestStore((s) => s.startDate);
  const endDate = useBacktestStore((s) => s.endDate);
  const capital = useBacktestStore((s) => s.capital);
  const applyCosts = useBacktestStore((s) => s.applyCosts);
  const loading = useBacktestStore((s) => s.loading);
  const set = useBacktestStore((s) => s.set);
  const toggleCosts = useBacktestStore((s) => s.toggleCosts);
  const runBacktest = useBacktestStore((s) => s.runBacktest);

  return (
    <div className="control-bar">
      <div className="cb-field cb-ticker">
        <TickerInput
          label="Instrument"
          value={ticker}
          onChange={(v) => set({ ticker: v })}
          disabled={loading}
        />
      </div>

      <div className="cb-field">
        <label htmlFor="cb-start">Start</label>
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
        <label htmlFor="cb-end">End</label>
        <input
          id="cb-end"
          type="date"
          value={endDate}
          onChange={(e) => set({ endDate: e.target.value })}
          disabled={loading}
        />
      </div>

      <div className="cb-field">
        <label htmlFor="cb-capital">Capital (₹)</label>
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

      <div className="cb-spacer" />

      <label className="cost-toggle" title="Apply Indian taxes (STT, brokerage, slippage)">
        <input type="checkbox" checked={applyCosts} onChange={toggleCosts} />
        <span className="cost-toggle-slider" />
        <span className="cost-toggle-label">{applyCosts ? 'Net of costs' : 'Gross'}</span>
      </label>

      <button className="cb-run" onClick={runBacktest} disabled={loading}>
        {loading ? <span className="spinner" /> : <Play size={15} />}
        {loading ? 'Running' : 'Run Backtest'}
      </button>
    </div>
  );
}
