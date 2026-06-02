import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Activity, Loader } from 'lucide-react';
import useBacktestStore from '../store/useBacktestStore';

const WFA_API = 'http://localhost:8000/api/backtest/wfa';

// Candidate parameter sets to optimize over each train window, per strategy.
// The in-sample winner of each fold is what gets tested out-of-sample.
function candidatesFor(strategyType) {
  switch (strategyType) {
    case 'MOVING_AVERAGE_CROSSOVER':
      return [
        { shortPeriod: 5, longPeriod: 20 },
        { shortPeriod: 10, longPeriod: 30 },
        { shortPeriod: 20, longPeriod: 50 },
        { shortPeriod: 50, longPeriod: 200 },
      ];
    case 'RSI':
      return [
        { rsiPeriod: 7, oversold: 25, overbought: 75 },
        { rsiPeriod: 14, oversold: 30, overbought: 70 },
        { rsiPeriod: 21, oversold: 35, overbought: 65 },
      ];
    case 'BOLLINGER_BREAKOUT':
      return [
        { bbPeriod: 10, bbStdDev: 1.5 },
        { bbPeriod: 20, bbStdDev: 2.0 },
        { bbPeriod: 50, bbStdDev: 2.5 },
      ];
    case 'DONCHIAN_BREAKOUT':
      return [{ dcPeriod: 10 }, { dcPeriod: 20 }, { dcPeriod: 55 }];
    default:
      return []; // MACD has no tunable params → nothing to optimize
  }
}

const VERDICT_CLS = { robust: 'wfa-robust', marginal: 'wfa-marginal', overfit: 'wfa-overfit', 'n/a': 'wfa-na' };

function paramStr(p) {
  return Object.entries(p).map(([k, v]) => `${k.replace(/Period|Dev/, '')}=${v}`).join(' ');
}
function fmtDate(s) {
  return s ? new Date(s).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : '—';
}
function fmtINR(n) {
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function WalkForward() {
  const ticker = useBacktestStore((s) => s.ranTicker || s.ticker);
  const strategyType = useBacktestStore((s) => s.strategyType);
  const capital = useBacktestStore((s) => s.capital);

  const [startDate, setStartDate] = useState('2018-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [trainBars, setTrainBars] = useState(252);
  const [testBars, setTestBars] = useState(63);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const candidates = candidatesFor(strategyType);
  const supported = candidates.length > 0;

  const run = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(WFA_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: ticker,
          strategyType,
          baseParams: { initialCapital: Number(capital) || 100000 },
          candidates,
          startDate,
          endDate,
          trainBars: Number(trainBars),
          testBars: Number(testBars),
          metric: 'sharpe',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail?.message || data?.message || 'Walk-forward failed');
      setResult(data);
    } catch (e) {
      setError(e.message || 'Walk-forward failed');
    } finally {
      setLoading(false);
    }
  };

  const summary = result?.summary;
  const noFolds = summary && summary.folds === 0;

  return (
    <div className="panel wfa-panel">
      <div className="panel-title-row">
        <span className="panel-title"><Activity size={14} /> Walk-Forward Analysis</span>
        <span className="panel-sub">out-of-sample robustness · {ticker} · {strategyType.replace(/_/g, ' ').toLowerCase()}</span>
      </div>

      {!supported ? (
        <div className="wfa-note">
          MACD has no tunable parameters in this engine, so there's nothing to optimize per fold.
          Pick MA Crossover, RSI, Bollinger, or Donchian to run walk-forward.
        </div>
      ) : (
        <>
          <div className="wfa-controls">
            <label>Start<input type="date" value={startDate} min="2016-06-01" onChange={(e) => setStartDate(e.target.value)} disabled={loading} /></label>
            <label>End<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={loading} /></label>
            <label>Train bars<input type="number" value={trainBars} min="20" max="2000" onChange={(e) => setTrainBars(e.target.value)} disabled={loading} /></label>
            <label>Test bars<input type="number" value={testBars} min="5" max="1000" onChange={(e) => setTestBars(e.target.value)} disabled={loading} /></label>
            <button className="wfa-run" onClick={run} disabled={loading}>
              {loading ? <Loader size={13} className="spin-icon" /> : <Activity size={13} />}
              {loading ? 'Running' : 'Run Walk-Forward'}
            </button>
            <span className="wfa-cand">{candidates.length} candidate param sets</span>
          </div>

          {error && <div className="wfa-error">{error}</div>}

          {noFolds && <div className="wfa-note">{summary.reason}</div>}

          {summary && !noFolds && (
            <>
              <div className="wfa-summary">
                <div className={`wfa-verdict ${VERDICT_CLS[summary.verdict]}`}>
                  <div className="wfa-verdict-label">Verdict</div>
                  <div className="wfa-verdict-val">{summary.verdict}</div>
                  <div className="wfa-eff">efficiency {summary.wfaEfficiency ?? '—'}</div>
                </div>
                <div className="wfa-stat"><span>Folds</span><strong>{summary.folds}</strong></div>
                <div className="wfa-stat"><span>In-sample Sharpe</span><strong>{summary.meanInSample ?? '—'}</strong></div>
                <div className="wfa-stat"><span>OOS Sharpe</span><strong className={summary.oosSharpe >= 0 ? 'positive' : 'negative'}>{summary.oosSharpe}</strong></div>
                <div className="wfa-stat"><span>OOS Return</span><strong className={summary.oosTotalReturn >= 0 ? 'positive' : 'negative'}>{summary.oosTotalReturn}%</strong></div>
                <div className="wfa-stat"><span>OOS Max DD</span><strong className="negative">{summary.oosMaxDrawdown}%</strong></div>
              </div>

              <div className="wfa-explain">
                The model is re-optimized on each train window, then tested on the next, unseen bars.
                <strong> Efficiency = OOS ÷ in-sample</strong>: near 1 means the edge generalizes; ≤ 0 means
                the in-sample optimization was fitting noise.
              </div>

              {result.stitchedOOS?.length > 1 && (
                <div className="chart-wrapper" style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.stitchedOOS} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" vertical={false} />
                      <XAxis dataKey="date" stroke="#475569" tickFormatter={fmtDate} minTickGap={50} fontSize={11} />
                      <YAxis stroke="#475569" tickFormatter={fmtINR} width={70} fontSize={11} domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                        formatter={(v) => [fmtINR(v), 'Stitched OOS equity']}
                        labelFormatter={(l) => new Date(l).toLocaleDateString('en-IN')}
                      />
                      <ReferenceLine y={Number(capital) || 100000} stroke="#475569" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="equity" stroke="#e05252" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="wfa-fold-scroll">
                <table className="tl-table wfa-fold-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Test window</th><th>Chosen params (in-sample)</th>
                      <th className="tl-num">IS</th><th className="tl-num">OOS</th>
                      <th className="tl-num">OOS Ret</th><th className="tl-num">Trades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.folds.map((f) => (
                      <tr key={f.fold}>
                        <td className="tl-dim">{f.fold}</td>
                        <td>{fmtDate(f.testStart)} → {fmtDate(f.testEnd)}</td>
                        <td className="wfa-params">{paramStr(f.bestParams)}</td>
                        <td className={`tl-num ${f.isMetric >= 0 ? 'positive' : 'negative'}`}>{f.isMetric}</td>
                        <td className={`tl-num ${f.oosMetric >= 0 ? 'positive' : 'negative'}`}>{f.oosMetric ?? '—'}</td>
                        <td className={`tl-num ${f.oosReturn >= 0 ? 'positive' : 'negative'}`}>{f.oosReturn}%</td>
                        <td className="tl-num tl-dim">{f.oosTrades}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
