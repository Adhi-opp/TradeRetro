import { useEffect, useRef, useState } from 'react';
import { Sun, Moon, BarChart3, Grid3x3, Settings, Activity, Database } from 'lucide-react';
import ControlBar from './ControlBar';
import StrategyConfig from './StrategyConfig';
import TearsheetGrid from './TearsheetGrid';
import PipelineDashboard from './PipelineDashboard';
import CrossAssetMonitor from './CrossAssetMonitor';
import DataQualityDashboard from './DataQualityDashboard';
import useBacktestStore from '../store/useBacktestStore';

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
  const loading = useBacktestStore((s) => s.loading);

  const isManual = mode === 'manual';

  return (
    <div className="ide-shell">
      <header className="ide-header">
        <div className="ide-header-left">
          <button className="app-logo app-logo-btn" onClick={onLogoClick} title="Back to landing">
            <h1>TradeRetro</h1>
            <span>v0.4</span>
          </button>
          <nav className="topbar-nav">
            <button
              className={`topbar-tab ${mode === 'manual' ? 'active' : ''}`}
              onClick={() => setMode('manual')}
              disabled={loading}
            >
              <BarChart3 size={14} />
              <span>Backtest</span>
            </button>
            <button
              className={`topbar-tab ${mode === 'correlation' ? 'active' : ''}`}
              onClick={() => setMode('correlation')}
              disabled={loading}
            >
              <Grid3x3 size={14} />
              <span>Cross-Asset</span>
            </button>
          </nav>
        </div>

        <div className="ide-header-actions">
          <MarketClock />
          <AdminMenu mode={mode} onSelect={setMode} />
          <button className="theme-toggle" onClick={onToggleTheme} title="Toggle theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {isManual ? (
        <div className="backtest-shell">
          <div className="backtest-controls">
            <ControlBar />
            <StrategyConfig />
          </div>
          <div className="backtest-body">
            <TearsheetGrid theme={theme} />
          </div>
        </div>
      ) : (
        <div className="ide-body ide-body-full">
          {mode === 'pipeline' && <PipelineDashboard />}
          {mode === 'correlation' && <CrossAssetMonitor />}
          {mode === 'data-quality' && <DataQualityDashboard />}
        </div>
      )}
    </div>
  );
}
