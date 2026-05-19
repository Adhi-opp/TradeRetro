import { useMemo, useState } from 'react';
import { Play, Loader, Target } from 'lucide-react';

// Strategy-specific sweepable params with sensible defaults
const SWEEP_PARAMS = {
  MOVING_AVERAGE_CROSSOVER: {
    options: [
      { name: 'shortPeriod', label: 'Short SMA', min: 5, max: 100, defaultStart: 10, defaultStop: 50, defaultStep: 10 },
      { name: 'longPeriod',  label: 'Long SMA',  min: 50, max: 400, defaultStart: 100, defaultStop: 300, defaultStep: 50 },
    ],
  },
  RSI: {
    options: [
      { name: 'rsiPeriod', label: 'RSI Period', min: 5, max: 50, defaultStart: 7, defaultStop: 21, defaultStep: 2 },
      { name: 'oversold',  label: 'Oversold', min: 10, max: 45, defaultStart: 20, defaultStop: 35, defaultStep: 5 },
      { name: 'overbought', label: 'Overbought', min: 55, max: 90, defaultStart: 65, defaultStop: 80, defaultStep: 5 },
    ],
  },
  MACD: { options: [] },
};

const METRIC_LABELS = {
  sharpe: 'Sharpe Ratio',
  totalReturn: 'Total Return %',
  maxDrawdown: 'Max Drawdown %',
  calmar: 'Calmar Ratio',
};

function range(start, stop, step) {
  if (step <= 0 || start > stop) return [start];
  const out = [];
  for (let v = start; v <= stop + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out.slice(0, 15); // backend caps at 15 per axis
}

// Color scale: red (worst) → amber (mid) → green (best).
// For sharpe/totalReturn/calmar: higher = better, natural mapping.
// For maxDrawdown: stored as negative (e.g. -5, -20), so higher (less negative)
// = better. Natural min→max mapping already gives the right direction —
// previously this function flipped it, making worst drawdowns greener.
function cellColor(value, min, max) {
  if (value == null || min == null || max == null || min === max) return 'rgba(120,130,145,0.15)';
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = t < 0.5 ? 239 : Math.round(239 - (239 - 34) * (t - 0.5) * 2);
  const g = t < 0.5 ? Math.round(68 + (197 - 68) * t * 2) : 197;
  const b = t < 0.5 ? Math.round(68 + (94 - 68) * t * 2) : 94;
  const opacity = 0.22 + 0.55 * t;
  return `rgba(${r},${g},${b},${opacity})`;
}

function fmtValue(v, metric) {
  if (v == null) return '—';
  if (metric === 'totalReturn' || metric === 'maxDrawdown') return `${v.toFixed(1)}%`;
  return v.toFixed(2);
}

export default function ParameterSweep({ ticker, strategyType, baseParams, dateRange }) {
  const spec = SWEEP_PARAMS[strategyType];

  const options = useMemo(() => spec?.options ?? [], [spec]);
  const [paramA, setParamA] = useState(options[0]?.name || '');
  const [paramB, setParamB] = useState(options[1]?.name || options[0]?.name || '');
  const optA = useMemo(() => options.find((o) => o.name === paramA), [options, paramA]);
  const optB = useMemo(() => options.find((o) => o.name === paramB), [options, paramB]);

  const [startA, setStartA] = useState(optA?.defaultStart ?? 10);
  const [stopA, setStopA]   = useState(optA?.defaultStop ?? 50);
  const [stepA, setStepA]   = useState(optA?.defaultStep ?? 10);
  const [startB, setStartB] = useState(optB?.defaultStart ?? 50);
  const [stopB, setStopB]   = useState(optB?.defaultStop ?? 200);
  const [stepB, setStepB]   = useState(optB?.defaultStep ?? 25);
  const [metric, setMetric] = useState('sharpe');

  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const valuesA = range(Number(startA), Number(stopA), Number(stepA));
  const valuesB = range(Number(startB), Number(stopB), Number(stepB));
  const cellCount = valuesA.length * valuesB.length;
  const estSeconds = Math.round(cellCount * 0.6); // rough estimate

  const runSweep = async () => {
    setError(null);
    setResult(null);
    setRunning(true);
    try {
      const body = {
        symbol: ticker,
        strategyType,
        baseParams,
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
        paramA, valuesA,
        paramB, valuesB,
        metric,
      };
      const r = await fetch('http://localhost:8000/api/backtest/sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.message || `HTTP ${r.status}`);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  // Compute heatmap color scale bounds from the result
  const colorBounds = useMemo(() => {
    if (!result?.grid) return { min: null, max: null };
    const values = result.grid
      .flat()
      .map((c) => c[metric])
      .filter((v) => v != null && Number.isFinite(v));
    if (values.length === 0) return { min: null, max: null };
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [result, metric]);

  // Early returns AFTER all hooks (React rules-of-hooks)
  if (!spec || options.length < 2) {
    return (
      <div className="panel">
        <div className="panel-title">Parameter Sweep</div>
        <div className="ca-empty">
          Sweep not available for {strategyType || 'this strategy'} — need at least 2 sweepable params.
        </div>
      </div>
    );
  }
  if (paramA === paramB) {
    return (
      <div className="panel">
        <div className="panel-title">Parameter Sweep</div>
        <div className="ca-empty ca-empty-warn">paramA and paramB must be different.</div>
      </div>
    );
  }

  return (
    <div className="panel sweep-panel">
      <div className="panel-title-row">
        <span className="panel-title">Parameter Sweep · Robustness</span>
        <span className="panel-sub">{strategyType} on {ticker}</span>
      </div>

      <div className="sweep-controls">
        <div className="sweep-control-group">
          <label>Param A (rows)</label>
          <select value={paramA} onChange={(e) => setParamA(e.target.value)}>
            {options.map((o) => <option key={o.name} value={o.name}>{o.label}</option>)}
          </select>
          <div className="sweep-range">
            <input type="number" value={startA} onChange={(e) => setStartA(e.target.value)} min={optA?.min} max={optA?.max} title="start" />
            <span>→</span>
            <input type="number" value={stopA} onChange={(e) => setStopA(e.target.value)} min={optA?.min} max={optA?.max} title="stop" />
            <span>step</span>
            <input type="number" value={stepA} onChange={(e) => setStepA(e.target.value)} min={1} title="step" />
          </div>
        </div>
        <div className="sweep-control-group">
          <label>Param B (cols)</label>
          <select value={paramB} onChange={(e) => setParamB(e.target.value)}>
            {options.map((o) => <option key={o.name} value={o.name}>{o.label}</option>)}
          </select>
          <div className="sweep-range">
            <input type="number" value={startB} onChange={(e) => setStartB(e.target.value)} min={optB?.min} max={optB?.max} title="start" />
            <span>→</span>
            <input type="number" value={stopB} onChange={(e) => setStopB(e.target.value)} min={optB?.min} max={optB?.max} title="stop" />
            <span>step</span>
            <input type="number" value={stepB} onChange={(e) => setStepB(e.target.value)} min={1} title="step" />
          </div>
        </div>
        <div className="sweep-control-group">
          <label>Optimize for</label>
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {Object.entries(METRIC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn-run sweep-run-btn" onClick={runSweep} disabled={running}>
            {running ? <><Loader size={13} className="spin-icon" /> Running {cellCount} backtests…</>
                     : <><Play size={13} /> Run sweep ({cellCount} cells · ~{estSeconds}s)</>}
          </button>
        </div>
      </div>

      {error && <div className="ca-empty ca-empty-warn">{error}</div>}

      {result && (
        <>
          <div className="sweep-meta">
            Ran <strong>{result.cellCount}</strong> backtests in <strong>{(result.executionTimeMs / 1000).toFixed(1)}s</strong>
            {result.best && (
              <span className="sweep-best">
                <Target size={12} /> Best ({METRIC_LABELS[metric]}):
                <strong> {result.axes.paramA.name}={result.best.paramA}, {result.axes.paramB.name}={result.best.paramB}</strong>
                — {fmtValue(result.best[metric], metric)}
              </span>
            )}
          </div>

          <div className="sweep-heatmap-wrap">
            <table className="sweep-heatmap">
              <thead>
                <tr>
                  <th className="sweep-corner">
                    <span className="sweep-axis-a">{result.axes.paramA.name}</span> ↓ ·
                    <span className="sweep-axis-b"> {result.axes.paramB.name}</span> →
                  </th>
                  {result.axes.paramB.values.map((v) => (
                    <th key={v}>{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.grid.map((row, i) => (
                  <tr key={result.axes.paramA.values[i]}>
                    <th>{result.axes.paramA.values[i]}</th>
                    {row.map((cell, j) => {
                      const value = cell[metric];
                      const isBest = result.best && cell.paramA === result.best.paramA && cell.paramB === result.best.paramB;
                      return (
                        <td
                          key={`${i}-${j}`}
                          className={`sweep-cell ${isBest ? 'sweep-best-cell' : ''} ${!cell.ok ? 'sweep-failed' : ''}`}
                          style={{ background: cell.ok ? cellColor(value, colorBounds.min, colorBounds.max) : undefined }}
                          title={cell.ok
                            ? `Sharpe ${fmtValue(cell.sharpe, 'sharpe')} · Return ${fmtValue(cell.totalReturn, 'totalReturn')} · MaxDD ${fmtValue(cell.maxDrawdown, 'maxDrawdown')} · ${cell.trades} trades`
                            : `Failed: ${cell.error || 'unknown'}`}
                        >
                          {cell.ok ? fmtValue(value, metric) : '✕'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
