import { ShieldCheck } from 'lucide-react';
import useBacktestStore from '../store/useBacktestStore';

const STRATEGIES = [
  { value: 'MOVING_AVERAGE_CROSSOVER', label: 'MA Crossover' },
  { value: 'RSI', label: 'RSI' },
  { value: 'MACD', label: 'MACD' },
  { value: 'BOLLINGER_BREAKOUT', label: 'Bollinger Breakout' },
  { value: 'DONCHIAN_BREAKOUT', label: 'Donchian Breakout' },
];

function NumField({ field, label, min, max, step }) {
  const value = useBacktestStore((s) => s[field]);
  const set = useBacktestStore((s) => s.set);
  const loading = useBacktestStore((s) => s.loading);
  return (
    <div className="sc-field">
      <label htmlFor={`sc-${field}`}>{label}</label>
      <input
        id={`sc-${field}`}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step || 1}
        disabled={loading}
        onChange={(e) => set({ [field]: e.target.value })}
      />
    </div>
  );
}

// Schema-driven param fields so switching strategy swaps inputs cleanly.
function StrategyParams({ strategyType }) {
  switch (strategyType) {
    case 'MOVING_AVERAGE_CROSSOVER':
      return (
        <>
          <NumField field="fastSma" label="Short SMA" min={2} max={200} />
          <NumField field="slowSma" label="Long SMA" min={5} max={500} />
        </>
      );
    case 'RSI':
      return (
        <>
          <NumField field="rsiPeriod" label="Period" min={2} max={200} />
          <NumField field="oversold" label="Oversold" min={1} max={49} />
          <NumField field="overbought" label="Overbought" min={51} max={99} />
        </>
      );
    case 'MACD':
      return <div className="sc-note">EMA 12 / 26 / 9 — signal-line crossover</div>;
    case 'BOLLINGER_BREAKOUT':
      return (
        <>
          <NumField field="bbPeriod" label="Period" min={5} max={200} />
          <NumField field="bbStdDev" label="Std Dev" min={0.5} max={5} step={0.1} />
        </>
      );
    case 'DONCHIAN_BREAKOUT':
      return <NumField field="dcPeriod" label="Channel" min={5} max={200} />;
    default:
      return null;
  }
}

export default function StrategyConfig() {
  const strategyType = useBacktestStore((s) => s.strategyType);
  const riskEnabled = useBacktestStore((s) => s.riskEnabled);
  const riskPct = useBacktestStore((s) => s.riskPct);
  const stopLossPct = useBacktestStore((s) => s.stopLossPct);
  const loading = useBacktestStore((s) => s.loading);
  const set = useBacktestStore((s) => s.set);

  return (
    <div className="strategy-config">
      <div className="sc-field sc-strategy">
        <label htmlFor="sc-strategy">Strategy</label>
        <select
          id="sc-strategy"
          value={strategyType}
          disabled={loading}
          onChange={(e) => set({ strategyType: e.target.value })}
        >
          {STRATEGIES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="sc-divider" />

      <StrategyParams strategyType={strategyType} />

      <div className="sc-spacer" />

      {/* Risk model — sizing + stop-loss. When off, engine runs all-in. */}
      <div className={`sc-risk ${riskEnabled ? 'on' : ''}`}>
        <button
          type="button"
          className={`sc-risk-toggle ${riskEnabled ? 'on' : ''}`}
          onClick={() => set({ riskEnabled: !riskEnabled })}
          disabled={loading}
          title="Size positions so a stop-out costs Risk% of equity"
        >
          <ShieldCheck size={13} />
          Risk Model {riskEnabled ? 'ON' : 'OFF'}
        </button>
        {riskEnabled && (
          <>
            <div className="sc-field sc-risk-field">
              <label htmlFor="sc-risk">Risk %</label>
              <input
                id="sc-risk"
                type="number"
                value={riskPct}
                min={0.1}
                max={50}
                step={0.5}
                disabled={loading}
                onChange={(e) => set({ riskPct: e.target.value })}
              />
            </div>
            <div className="sc-field sc-risk-field">
              <label htmlFor="sc-stop">Stop %</label>
              <input
                id="sc-stop"
                type="number"
                value={stopLossPct}
                min={0.5}
                max={50}
                step={0.5}
                disabled={loading}
                onChange={(e) => set({ stopLossPct: e.target.value })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
