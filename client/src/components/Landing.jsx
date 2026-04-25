import { Terminal, Sun, Moon, BarChart3, TrendingUp, Zap, Database } from 'lucide-react';

export default function Landing({ onEnter, theme, onToggleTheme }) {
  return (
    <div className="landing">
      <button className="theme-toggle landing-theme-toggle" onClick={onToggleTheme} title="Toggle theme">
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div className="landing-content">
        <div className="landing-logo-section">
          <div className="landing-icon">
            <Terminal size={56} />
          </div>
          <h1 className="landing-title">TradeRetro</h1>
          <p className="landing-subtitle">
            Financial Data Pipeline &amp; Quant Backtester
          </p>
        </div>

        <p className="landing-desc">
          High-throughput NSE market data pipeline with TimescaleDB, Redis, Prefect,
          and a Python backtesting engine built for Indian transaction costs.
        </p>

        <div className="landing-features">
          <div className="landing-feature">
            <BarChart3 size={20} />
            <div>
              <div className="landing-feature-title">3 Verified Strategies</div>
              <div className="landing-feature-desc">MA crossover, RSI, and MACD</div>
            </div>
          </div>
          <div className="landing-feature">
            <Database size={20} />
            <div>
              <div className="landing-feature-title">Timescale Warehouse</div>
              <div className="landing-feature-desc">Backfill, quality gates, freshness</div>
            </div>
          </div>
          <div className="landing-feature">
            <TrendingUp size={20} />
            <div>
              <div className="landing-feature-title">Cross-Asset</div>
              <div className="landing-feature-desc">Correlation matrix + macro signals</div>
            </div>
          </div>
          <div className="landing-feature">
            <Zap size={20} />
            <div>
              <div className="landing-feature-title">Data Ops</div>
              <div className="landing-feature-desc">Real-time quality &amp; freshness monitoring</div>
            </div>
          </div>
        </div>

        <button className="landing-btn" onClick={onEnter}>
          Launch Terminal
        </button>

        <div className="landing-stack">
          <span>FastAPI</span>
          <span>React</span>
          <span>TimescaleDB</span>
          <span>Redis</span>
          <span>Prefect</span>
        </div>

        <div className="landing-version">v0.3 - FastAPI + TimescaleDB</div>
      </div>
    </div>
  );
}
