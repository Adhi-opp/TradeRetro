import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import LeftPane from './LeftPane';
import RightPane from './RightPane';

const TIMEOUT_MS = 30000;       // 30s for backtest & monte carlo
const VERIFY_TIMEOUT_MS = 30000; // 30s for AI verify (Python execution)

function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

export default function Dashboard({ onLogoClick, theme, onToggleTheme }) {
  const [mode, setMode] = useState('manual'); // 'manual' | 'ai'
  const [result, setResult] = useState(null);
  const [verdictResult, setVerdictResult] = useState(null);
  const [monteCarloResult, setMonteCarloResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [applyCosts, setApplyCosts] = useState(false);
  const [backtestTicker, setBacktestTicker] = useState(null);
  const [strategyParams, setStrategyParams] = useState(null);
  const [backtestRange, setBacktestRange] = useState(null);

  const getErrorMessage = (data, fallback) => {
    if (!data) return fallback;
    if (typeof data === 'string') return data;
    if (data.message) return data.message;
    if (data.error && typeof data.error === 'string') return data.error;
    if (typeof data.detail === 'string') return data.detail;
    if (data.detail?.message) return data.detail.message;
    return fallback;
  };

  const buildParams = (formParams) => {
    const capital = formParams.initialCapital || 100000;
    const paramsByStrategy = {
      MOVING_AVERAGE_CROSSOVER: {
        shortPeriod: formParams.fastSma,
        longPeriod: formParams.slowSma,
        initialCapital: capital,
      },
      RSI: {
        rsiPeriod: formParams.rsiPeriod,
        oversold: formParams.oversold,
        overbought: formParams.overbought,
        initialCapital: capital,
      },
      MACD: {
        initialCapital: capital,
      },
    };

    return paramsByStrategy[formParams.strategyType];
  };

  const handleRunBacktest = async (formParams) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setMonteCarloResult(null);

    const payload = {
      symbol: formParams.ticker,
      strategyType: formParams.strategyType,
      params: buildParams(formParams),
      startDate: formParams.startDate,
      endDate: formParams.endDate,
    };

    try {
      const response = await fetchWithTimeout('http://localhost:8000/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, TIMEOUT_MS);
      const data = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data, 'Backend rejected request'));
      setResult(data);
      setBacktestTicker(formParams.ticker.toUpperCase());
      setBacktestRange({
        startDate: formParams.startDate,
        endDate: formParams.endDate,
      });
      setStrategyParams({
        strategyType: formParams.strategyType,
        fastSma: formParams.fastSma,
        slowSma: formParams.slowSma,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out — server took too long to respond');
      } else {
        setError(err.message || 'Failed to connect to server');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRunMonteCarlo = async (formParams) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setMonteCarloResult(null);

    const payload = {
      symbol: formParams.ticker,
      strategyType: formParams.strategyType,
      params: buildParams(formParams),
      startDate: formParams.startDate,
      endDate: formParams.endDate,
      runs: 30,
    };

    try {
      const response = await fetchWithTimeout('http://localhost:8000/api/monte-carlo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, TIMEOUT_MS);
      const data = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data, 'Monte Carlo failed'));
      setMonteCarloResult(data);
      setBacktestTicker(formParams.ticker.toUpperCase());
      setBacktestRange({
        startDate: formParams.startDate,
        endDate: formParams.endDate,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out — Monte Carlo took too long');
      } else {
        setError(err.message || 'Failed to connect to server');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (payload) => {
    setLoading(true);
    setError(null);
    setVerdictResult(null);

    try {
      const response = await fetchWithTimeout('http://localhost:8000/api/verify-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, VERIFY_TIMEOUT_MS);
      const data = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data, 'Verification failed'));
      setVerdictResult(data);
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('AI verification timed out — code may be too complex, invalid, or stuck in a long-running branch');
      } else {
        setError(err.message || 'Failed to connect to BS Detector service');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError(null);
  };

  return (
    <div className="ide-shell">
      <header className="ide-header">
        <button className="app-logo app-logo-btn" onClick={onLogoClick} title="Back to landing">
          <h1>TradeRetro</h1>
          <span>v0.2</span>
        </button>
        <div className="ide-header-actions">
          {mode === 'manual' && (
            <label className="cost-toggle" title="Apply real-world Indian taxes (STT, brokerage, slippage)">
              <input
                type="checkbox"
                checked={applyCosts}
                onChange={(e) => setApplyCosts(e.target.checked)}
              />
              <span className="cost-toggle-slider" />
              <span className="cost-toggle-label">
                {applyCosts ? 'Indian Taxes ON' : 'Gross Returns'}
              </span>
            </label>
          )}
          <button className="theme-toggle" onClick={onToggleTheme} title="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <div className="ide-body">
        <LeftPane
          mode={mode}
          onSwitchMode={switchMode}
          onRunBacktest={handleRunBacktest}
          onRunMonteCarlo={handleRunMonteCarlo}
          onVerify={handleVerify}
          loading={loading}
          error={error}
        />
        <RightPane
          mode={mode}
          result={result}
          verdictResult={verdictResult}
          monteCarloResult={monteCarloResult}
          loading={loading}
          error={error}
          applyCosts={applyCosts}
          theme={theme}
          backtestTicker={backtestTicker}
          strategyParams={strategyParams}
          backtestRange={backtestRange}
        />
      </div>
    </div>
  );
}
