import { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, Sun, Moon } from 'lucide-react';
import LeftPane from './LeftPane';
import RightPane from './RightPane';

export default function Dashboard({ onLogoClick, theme, onToggleTheme }) {
  const [mode, setMode] = useState('manual'); // 'manual' | 'ai'
  const [result, setResult] = useState(null);
  const [verdictResult, setVerdictResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const handleRunBacktest = async (formParams) => {
    setLoading(true);
    setError(null);
    setResult(null);

    const paramsByStrategy = {
      MOVING_AVERAGE_CROSSOVER: {
        shortPeriod: formParams.fastSma,
        longPeriod: formParams.slowSma,
        initialCapital: 10000,
      },
      RSI: {
        rsiPeriod: formParams.rsiPeriod,
        oversold: formParams.oversold,
        overbought: formParams.overbought,
        initialCapital: 10000,
      },
      MACD: {
        initialCapital: 10000,
      },
    };

    const payload = {
      symbol: formParams.ticker,
      strategyType: formParams.strategyType,
      params: paramsByStrategy[formParams.strategyType],
      startDate: formParams.startDate,
      endDate: formParams.endDate,
    };

    try {
      const response = await fetch('http://localhost:5000/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Backend rejected request');
      }

      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (payload) => {
    setLoading(true);
    setError(null);
    setVerdictResult(null);

    try {
      const response = await fetch('http://localhost:5000/api/verify-ai-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.detail || 'Verification failed');
      }

      setVerdictResult(data);
    } catch (err) {
      setError(err.message || 'Failed to connect to BS Detector service');
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
      {/* Top Bar */}
      <header className="ide-header">
        <button className="app-logo app-logo-btn" onClick={onLogoClick} title="Back to landing">
          <h1>TradeRetro</h1>
          <span>v0.1</span>
        </button>
        <div className="ide-header-actions">
          <button className="theme-toggle" onClick={onToggleTheme} title="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Show control panel' : 'Hide control panel'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
      </header>

      {/* Split Pane */}
      <div className="ide-body">
        <LeftPane
          mode={mode}
          onSwitchMode={switchMode}
          onRunBacktest={handleRunBacktest}
          onVerify={handleVerify}
          loading={loading}
          error={error}
          collapsed={collapsed}
        />
        <RightPane
          mode={mode}
          result={result}
          verdictResult={verdictResult}
          loading={loading}
        />
      </div>
    </div>
  );
}
