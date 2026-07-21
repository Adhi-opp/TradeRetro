import { useEffect, useRef, useState } from 'react';
import { Sun, Moon, BarChart3, Grid3x3, Settings, Activity, Database, Menu, X, Pin, PinOff, Bell, Search } from 'lucide-react';
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

const navItems = [
  { mode: 'manual', label: 'Dashboard', icon: BarChart3 },
  { mode: 'correlation', label: 'Cross-Asset', icon: Grid3x3 },
  { mode: 'pipeline', label: 'Data Pipeline', icon: Activity },
  { mode: 'data-quality', label: 'Data Quality', icon: Database },
];

const pageMeta = {
  manual: {
    title: 'Backtesting Dashboard',
    eyebrow: 'Primary Workspace',
    description: 'Event-driven validation for retail algorithmic trading strategies.',
  },
  correlation: {
    title: 'Cross-Asset Monitor',
    eyebrow: 'Primary Workspace',
    description: 'Live ticks, volatility regime, and correlation analytics.',
  },
  pipeline: {
    title: 'Data Pipeline',
    eyebrow: 'Infrastructure',
    description: 'Pipeline telemetry and ingestion health.',
  },
  'data-quality': {
    title: 'Data Quality',
    eyebrow: 'Infrastructure',
    description: 'Backfill coverage, freshness, and ticker inventory.',
  },
};

export default function Dashboard({ onLogoClick, theme, onToggleTheme }) {
  const [mode, setMode] = useState('manual');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const loading = useBacktestStore((s) => s.loading);

  const isManual = mode === 'manual';
  const activePage = pageMeta[mode];
  const selectMode = (nextMode) => {
    setMode(nextMode);
    setDrawerOpen(false);
  };

  return (
    <div className={`ide-shell app-shell-v2 ${sidebarPinned ? 'sidebar-pinned' : ''}`}>
      <aside className="ide-sidebar app-sidebar-v2" aria-label="Primary navigation">
        <div className="sidebar-brand" onClick={onLogoClick} title="Back to launch screen">
          <div className="brand-logo-icon" aria-hidden="true" />
          <div className="brand-text">
            <h1>TradeRetro</h1>
            <span>Main Workspace</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ mode: itemMode, label, icon: Icon }) => (
            <button
              key={itemMode}
              className={`sidebar-tab ${mode === itemMode ? 'active' : ''}`}
              onClick={() => selectMode(itemMode)}
              disabled={loading && itemMode !== 'pipeline' && itemMode !== 'data-quality'}
              title={label}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-project-card">
          <span className="card-label">STUDY PROJECT</span>
          <p className="card-desc">Event-driven validation for retail algorithmic trading strategies.</p>
        </div>

        <button
          className={`sidebar-pin-btn ${sidebarPinned ? 'active' : ''}`}
          onClick={() => setSidebarPinned((pinned) => !pinned)}
          title={sidebarPinned ? 'Unpin sidebar' : 'Pin expanded sidebar'}
          aria-pressed={sidebarPinned}
        >
          {sidebarPinned ? <PinOff size={16} /> : <Pin size={16} />}
          <span>{sidebarPinned ? 'Unpin' : 'Pin'}</span>
        </button>
      </aside>

      <div className="ide-main-content">
        <header className="global-app-bar">
          <div className="app-bar-left">
            <button className="menu-toggle-btn mobile-menu-btn" onClick={() => setDrawerOpen(true)} title="Open navigation">
              <Menu size={20} />
            </button>
            <div className="app-bar-titleblock">
              <span className="workspace-pill">{activePage.eyebrow}</span>
              <span className="current-page-label">{activePage.title}</span>
            </div>
          </div>
          <div className="app-bar-center">
            <div className="global-search-container">
              <Search size={14} />
              <input type="text" placeholder="Search terminal or commands (Ctrl + K)..." disabled />
              <span className="search-shortcut">⌘K</span>
            </div>
          </div>
          <div className="app-bar-right">
            <MarketClock />
            <div className="sync-indicator">
              <span className="sync-dot" />
              <span>Synced</span>
            </div>
            <button className="theme-toggle" onClick={onToggleTheme} title="Toggle theme">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button className="notification-btn" title="Notifications">
              <Bell size={15} />
            </button>
            <div className="user-avatar" title="User Profile">
              <span>TR</span>
            </div>
          </div>
        </header>

        <div className="view-container">
          {isManual ? (
            <div className="page-container-v2 backtest-shell">
              <div className="hero-header-section">
                <div className="hero-header-left">
                  <h1 className="hero-title">{activePage.title}</h1>
                  <p className="hero-subtitle">{activePage.description}</p>
                </div>
                <div className="hero-header-right">
                  <button className="refresh-btn" onClick={() => window.location.reload()} title="Refresh Terminal">
                    Refresh
                  </button>
                </div>
              </div>

              <section className="backtest-engine-card" aria-labelledby="backtest-engine-title">
                <div className="engine-header">
                  <div>
                    <span className="engine-eyebrow">Backtest Engine</span>
                    <h2 id="backtest-engine-title">Configure, validate, execute</h2>
                  </div>
                  <span className="engine-status-chip">Manual workflow</span>
                </div>
                <div className="backtest-controls">
                  <StrategyConfig />
                  <ControlBar />
                </div>
              </section>

              <div className="backtest-body">
                <TearsheetGrid theme={theme} />
              </div>
            </div>
          ) : (
            <div className="page-container-v2 ide-body ide-body-full">
              {mode === 'pipeline' && <PipelineDashboard theme={theme} />}
              {mode === 'correlation' && <CrossAssetMonitor />}
              {mode === 'data-quality' && <DataQualityDashboard />}
            </div>
          )}
        </div>
      </div>

      {/* Mobile/Tablet drawer navigation */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-logo">
                <h1>TradeRetro</h1>
                <span>Backtest Engine</span>
              </div>
              <button className="drawer-close" onClick={() => setDrawerOpen(false)} title="Close menu">
                <X size={20} />
              </button>
            </div>
            <nav className="drawer-nav">
              {navItems.map(({ mode: itemMode, label, icon: Icon }) => (
                <button
                  key={itemMode}
                  className={`drawer-tab ${mode === itemMode ? 'active' : ''}`}
                  onClick={() => selectMode(itemMode)}
                  disabled={loading && itemMode !== 'pipeline' && itemMode !== 'data-quality'}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            <div className="drawer-footer">
              <MarketClock />
              <div className="drawer-footer-actions">
                <button className="theme-toggle-btn" onClick={onToggleTheme}>
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                  <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
