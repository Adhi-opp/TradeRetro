import { useState } from 'react';
import { Play } from 'lucide-react';

const STRATEGIES = [
  { value: 'MOVING_AVERAGE_CROSSOVER', label: 'Moving Average Crossover' },
  { value: 'RSI', label: 'RSI (Relative Strength Index)' },
  { value: 'MACD', label: 'MACD' },
];

const STOCKS = {
  nse: [
    { value: 'RELIANCE',   label: 'Reliance Industries' },
    { value: 'TCS',        label: 'Tata Consultancy Services' },
    { value: 'HDFCBANK',   label: 'HDFC Bank' },
    { value: 'INFY',       label: 'Infosys' },
    { value: 'ICICIBANK',  label: 'ICICI Bank' },
    { value: 'SBIN',       label: 'State Bank of India' },
    { value: 'HINDUNILVR', label: 'Hindustan Unilever' },
    { value: 'BAJFINANCE', label: 'Bajaj Finance' },
    { value: 'BHARTIARTL', label: 'Bharti Airtel' },
    { value: 'WIPRO',      label: 'Wipro' },
  ],
  us: [
    { value: 'AAPL', label: 'Apple Inc.' },
  ],
};

export default function StrategyForm({ onRunBacktest, isLoading }) {
  const [ticker, setTicker] = useState('RELIANCE');
  const [strategyType, setStrategyType] = useState('MOVING_AVERAGE_CROSSOVER');
  const [fastSma, setFastSma] = useState(50);
  const [slowSma, setSlowSma] = useState(200);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [oversold, setOversold] = useState(30);
  const [overbought, setOverbought] = useState(70);
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onRunBacktest({
      ticker: ticker.toUpperCase(),
      strategyType,
      fastSma: Number(fastSma),
      slowSma: Number(slowSma),
      rsiPeriod: Number(rsiPeriod),
      oversold: Number(oversold),
      overbought: Number(overbought),
      startDate,
      endDate,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="form-panel">
      <div className="form-panel-title">Strategy Configuration</div>

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="ticker">Stock</label>
          <select
            id="ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            disabled={isLoading}
          >
            <optgroup label="NSE (India)">
              {STOCKS.nse.map((s) => (
                <option key={s.value} value={s.value}>{s.value} — {s.label}</option>
              ))}
            </optgroup>
            <optgroup label="US Market">
              {STOCKS.us.map((s) => (
                <option key={s.value} value={s.value}>{s.value} — {s.label}</option>
              ))}
            </optgroup>
          </select>
        </div>

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
            required
          />
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
        </div>
      </div>
    </form>
  );
}
