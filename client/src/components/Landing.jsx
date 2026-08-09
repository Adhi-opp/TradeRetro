import { createElement } from 'react';
import { Terminal, Sun, Moon, Database, Activity, FlaskConical, RotateCcw } from 'lucide-react';
import TradeRetroLogo from './ui/TradeRetroLogo';

const CAPABILITIES = [
  { Icon: FlaskConical, title: 'Strategy Validation', desc: 'Test systematic trading ideas against historical market behaviour.' },
  { Icon: Database, title: 'Historical Data', desc: 'Explore structured market data through the Timescale warehouse.' },
  { Icon: RotateCcw, title: 'Backtesting', desc: 'Evaluate strategies with deterministic execution and Indian transaction costs.' },
  { Icon: Activity, title: 'Data Operations', desc: 'Monitor ingestion, freshness and pipeline health.' },
];

const STACK = ['FastAPI', 'React', 'TimescaleDB', 'Redis', 'Prefect', 'Python'];

export default function Landing({ onEnter, theme, onToggleTheme }) {
  return (
    <div className="landing">
      <button className="theme-toggle landing-theme-toggle" onClick={onToggleTheme} title="Toggle theme" aria-label="Toggle dark/light theme">
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div className="landing-content">
        <div className="landing-brand">
          <div className="landing-logo">
            <TradeRetroLogo size={56} />
          </div>
          <h1 className="landing-title">TradeRetro</h1>
          <p className="landing-tagline">Look Back. Test Better.</p>
        </div>

        <p className="landing-desc">
          TradeRetro turns historical market data into a controlled environment for
          strategy validation, backtesting and quantitative analysis.
        </p>

        <div className="landing-features">
          {CAPABILITIES.map(({ Icon, title, desc }) => (
            <div className="landing-feature" key={title}>
              <div className="landing-feature-icon">
                {createElement(Icon, { size: 17, strokeWidth: 1.9 })}
              </div>
              <div className="landing-feature-body">
                <div className="landing-feature-title">{title}</div>
                <div className="landing-feature-desc">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <button className="landing-btn" onClick={onEnter}>
          <Terminal size={17} strokeWidth={2} />
          Launch Terminal
        </button>

        <div className="landing-stack">
          {STACK.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>

        <div className="landing-version">v0.4 - FastAPI + TimescaleDB</div>
      </div>
    </div>
  );
}