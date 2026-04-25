import { useState } from 'react';
import { Play, Shuffle } from 'lucide-react';
import TickerInput from './TickerInput';

const STRATEGIES = [
  { value: 'MOVING_AVERAGE_CROSSOVER', label: 'Moving Average Crossover' },
  { value: 'RSI', label: 'RSI (Relative Strength Index)' },
  { value: 'MACD', label: 'MACD' },
];

export default function StrategyForm({ onRunBacktest, onRunMonteCarlo, isLoading }) {
  const [ticker, setTicker] = useState('RELIANCE.NS');
  const [strategyType, setStrategyType] = useState('MOVING_AVERAGE_CROSSOVER');
  const [fastSma, setFastSma] = useState(50);
  const [slowSma, setSlowSma] = useState(200);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [oversold, setOversold] = useState(30);
  const [overbought, setOverbought] = useState(70);
  const [initialCapital, setInitialCapital] = useState(100000);
  const [startDate, setStartDate] = useState('2025-04-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const getFormParams = () => ({
    ticker: (ticker || '').toUpperCase(),
    strategyType,
    initialCapital: Number(initialCapital),
    fastSma: Number(fastSma),
    slowSma: Number(slowSma),
    rsiPeriod: Number(rsiPeriod),
    oversold: Number(oversold),
    overbought: Number(overbought),
    startDate,
    endDate,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onRunBacktest(getFormParams());
  };

  const handleMonteCarlo = () => {
    if (onRunMonteCarlo) onRunMonteCarlo(getFormParams());
  };

  return (
    <form onSubmit={handleSubmit} className="form-panel">
      <div className="form-panel-title">Strategy Configuration</div>

      <div className="form-grid">
        <TickerInput
          label="Stock / Index / Macro"
          value={ticker}
          onChange={setTicker}
          disabled={isLoading}
        />

        <div className="form-field">
          <label htmlFor="strategyType">Strategy</label>
          <select
            id="strategyType"
            value={strategyType}
            onChange={(e) => setStrategyType(e.target.value)}
            disabled={isLoading}
          >
            {STRATEGIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="initialCapital">Initial Capital (₹)</label>
          <input
            id="initialCapital"
            type="number"
            value={initialCapital}
            onChange={(e) => setInitialCapital(e.target.value)}
            disabled={isLoading}
            required
            min="1000"
            max="100000000"
            step="1000"
          />
        </div>

        {strategyType === 'MOVING_AVERAGE_CROSSOVER' && (
          <>
            <div className="form-field">
              <label htmlFor="fastSma">Short SMA</label>
              <input
                id="fastSma"
                type="number"
                value={fastSma}
                onChange={(e) => setFastSma(e.target.value)}
                disabled={isLoading}
                required
                min="2"
                max="200"
              />
            </div>

            <div className="form-field">
              <label htmlFor="slowSma">Long SMA</label>
              <input
                id="slowSma"
                type="number"
                value={slowSma}
                onChange={(e) => setSlowSma(e.target.value)}
                disabled={isLoading}
                required
                min="5"
                max="500"
              />
            </div>
          </>
        )}

        {strategyType === 'RSI' && (
          <>
            <div className="form-field">
              <label htmlFor="rsiPeriod">RSI Period</label>
              <input
                id="rsiPeriod"
                type="number"
                value={rsiPeriod}
                onChange={(e) => setRsiPeriod(e.target.value)}
                disabled={isLoading}
                required
                min="2"
                max="200"
              />
            </div>

            <div className="form-field">
              <label htmlFor="oversold">Oversold</label>
              <input
                id="oversold"
                type="number"
                value={oversold}
                onChange={(e) => setOversold(e.target.value)}
                disabled={isLoading}
                required
                min="1"
                max="49"
              />
            </div>

            <div className="form-field">
              <label htmlFor="overbought">Overbought</label>
              <input
                id="overbought"
                type="number"
                value={overbought}
                onChange={(e) => setOverbought(e.target.value)}
                disabled={isLoading}
                required
                min="51"
                max="99"
              />
            </div>
          </>
        )}

        <div className="form-field">
          <label htmlFor="startDate">Start Date</label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isLoading}
            min="2024-04-18"
            required
          />
          <small className="field-hint">Warehouse starts 2024-04-18 · leave warm-up room for Slow SMA</small>
        </div>

        <div className="form-field">
          <label htmlFor="endDate">End Date</label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-run" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="spinner" />
                Running...
              </>
            ) : (
              <>
                <Play size={15} />
                Run Backtest
              </>
            )}
          </button>
          <button type="button" className="btn-monte-carlo" disabled={isLoading} onClick={handleMonteCarlo}>
            <Shuffle size={15} />
            Monte Carlo
          </button>
        </div>
      </div>
    </form>
  );
}
