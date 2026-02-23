import { Terminal, Sun, Moon } from 'lucide-react';

export default function Landing({ onEnter, theme, onToggleTheme }) {
  return (
    <div className="landing">
      <button className="theme-toggle landing-theme-toggle" onClick={onToggleTheme} title="Toggle theme">
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div className="landing-content">
        <div className="landing-icon">
          <Terminal size={48} />
        </div>
        <h1 className="landing-title">TradeRetro</h1>
        <p className="landing-subtitle">
          Institutional Backtester & AI Truth Engine
        </p>
        <p className="landing-desc">
          Testing LLM hallucination against real Indian STT, slippage, and synthetic Markov Regime-Switching market data.
        </p>
        <button className="landing-btn" onClick={onEnter}>
          Launch Terminal
        </button>
        <div className="landing-version">v0.2 — sandbox</div>
      </div>
    </div>
  );
}
