import { useEffect, useRef, useState } from 'react';
import { Sun, Moon, BarChart3, Grid3x3, Settings, Activity, Database } from 'lucide-react';
import LeftPane from './LeftPane';
import PipelineDashboard from './PipelineDashboard';
import RightPane from './RightPane';
import CrossAssetMonitor from './CrossAssetMonitor';
import DataQualityDashboard from './DataQualityDashboard';

const TIMEOUT_MS = 30000;

function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

function MarketClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  const timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(now));
  const day = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(now);
  const isWeekend = day === 'Sat' || day === 'Sun';
  const isOpen = !isWeekend && hour >= 9 && hour < 16;
  return (
    <div className="market-clock">
      <span className={`market-status-dot ${isOpen ? 'on' : 'off'}`} />
      <span className="market-status-text mono">{isOpen ? 'NSE OPEN' : 'NSE CLOSED'}</span>
      <span className="market-time mono">{timeStr} IST</span>
    </div>
  );
}

function AdminMenu({ mode, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [open]);
  const isAdmin = mode === 'pipeline' || mode === 'data-quality';
  return (
    <div className="admin-menu" ref={ref}>
      <button
        className={`admin-gear ${isAdmin ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
        title="Infrastructure & diagnostics"
      >
        <Settings size={15} />
      </button>
      {open && (
        <div className="admin-dropdown">
          <div className="admin-dropdown-label">Infrastructure</div>
          <button
            className={`admin-dropdown-item ${mode === 'pipeline' ? 'active' : ''}`}
            onClick={() => { onSelect('pipeline'); setOpen(false); }}
          >
            <Activity size={14} />
            <div>
              <div>Data Pipeline</div>
              <span>Grafana observability · ingestion health</span>
            </div>
          </button>
          <button
            className={`admin-dropdown-item ${mode === 'data-quality' ? 'active' : ''}`}
            onClick={() => { onSelect('data-quality'); setOpen(false); }}
          >
            <Database size={14} />
            <div>
              <div>Data Quality</div>
              <span>Per-ticker backfill · freshness · coverage</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ onLogoClick, theme, onToggleTheme }) {
  const [mode, setMode] = useState('manual');
  const [result, setResult] = useState(null);
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
      MACD: { initialCapital: capital },
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
      setBacktestRange({ startDate: formParams.startDate, endDate: formParams.endDate });
      setStrategyParams({
        strategyType: formParams.strategyType,
        fastSma: formParams.fastSma,
        slowSma: formParams.slowSma,
      });
    } catch (err) {
      if (err.name === 'AbortError') setError('Request timed out — server took too long to respond');
      else setError(err.message || 'Failed to connect to server');
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
      setBacktestRange({ startDate: formParams.startDate, endDate: formParams.endDate });
    } catch (err) {
      if (err.name === 'AbortError') setError('Request timed out — Monte Carlo took too long');
      else setError(err.message || 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError(null);
  };

  const isManual = mode === 'manual';
  const showLeftPane = isManual;

  return (
    <div className="ide-shell">
      <header className="ide-header">
        <div className="ide-header-left">
          <button className="app-logo app-logo-btn" onClick={onLogoClick} title="Back to landing">
            <h1>TradeRetro</h1>
            <span>v0.3</span>
          </button>
          <nav className="topbar-nav">
            <button
              className={`topbar-tab ${mode === 'manual' ? 'active' : ''}`}
              onClick={() => switchMode('manual')}
              disabled={loading}
            >
              <BarChart3 size={14} />
              <span>Backtest</span>
            </button>
            <button
              className={`topbar-tab ${mode === 'correlation' ? 'active' : ''}`}
              onClick={() => switchMode('correlation')}
              disabled={loading}
            >
              <Grid3x3 size={14} />
              <span>Cross-Asset</span>
            </button>
          </nav>
        </div>

        <div className="ide-header-actions">
          <MarketClock />
          {isManual && (
            <label className="cost-toggle" title="Apply Indian taxes (STT, brokerage, slippage)">
              <input
                type="checkbox"
                checked={applyCosts}
                onChange={(e) => setApplyCosts(e.target.checked)}
              />
              <span className="cost-toggle-slider" />
              <span className="cost-toggle-label">{applyCosts ? 'Taxes ON' : 'Gross'}</span>
            </label>
          )}
          <AdminMenu mode={mode} onSelect={switchMode} />
          <button className="theme-toggle" onClick={onToggleTheme} title="Toggle theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <div className={`ide-body ${showLeftPane ? '' : 'ide-body-full'}`}>
        {showLeftPane && (
          <LeftPane
            mode={mode}
            onRunBacktest={handleRunBacktest}
            onRunMonteCarlo={handleRunMonteCarlo}
            loading={loading}
            error={error}
          />
        )}
        {mode === 'pipeline' ? (
          <PipelineDashboard />
        ) : mode === 'correlation' ? (
          <CrossAssetMonitor />
        ) : mode === 'data-quality' ? (
          <DataQualityDashboard />
        ) : (
          <RightPane
            mode={mode}
            result={result}
            monteCarloResult={monteCarloResult}
            loading={loading}
            error={error}
            applyCosts={applyCosts}
            theme={theme}
            backtestTicker={backtestTicker}
            strategyParams={strategyParams}
            backtestRange={backtestRange}
          />
        )}
      </div>
    </div>
  );
}
