import { useEffect, useState } from 'react';
import { Sun, Moon, ArrowRight } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const fmt = (n) =>
  n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

/**
 * Live warehouse counters.
 *
 * The landing page used to be four static feature cards floating in whitespace
 * — it asserted the pipeline existed without showing it. These read the real
 * warehouse, so the first thing on screen is evidence the stack is up.
 */
function useWarehouseStats() {
  const [stats, setStats] = useState(null);
  const [state, setState] = useState('loading'); // loading | live | offline

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health/pipeline`, {
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) throw new Error(String(res.status));
        const d = await res.json();
        if (cancelled) return;
        setStats(d);
        setState('live');
      } catch {
        if (!cancelled) setState('offline');
      }
    };

    load();
    const iv = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  return { stats, state };
}

/** One stage of the medallion funnel: raw ticks narrowing into daily bars. */
function Stage({ tier, value, label, sub, delay }) {
  return (
    <div className={`lnd-stage lnd-stage-${tier}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="lnd-stage-tier">{tier}</div>
      <div className="lnd-stage-value">{value}</div>
      <div className="lnd-stage-label">{label}</div>
      {sub && <div className="lnd-stage-sub">{sub}</div>}
    </div>
  );
}

export default function Landing({ onEnter, theme, onToggleTheme }) {
  const { stats, state } = useWarehouseStats();

  const bronze = stats?.bronze?.rows;
  const silver = stats?.silver?.bars;
  const gold = stats?.gold_5min?.bars;
  const warehouse = stats?.raw?.rows;
  const rate = stats?.bronze?.ticks_per_minute ?? 0;
  const instruments = stats?.bronze?.instruments;
  const tickers = stats?.raw?.tickers;
  // The simulator and the real producer both stand down outside the NSE
  // stream window, so a zero rate while connected means idle, not broken.
  const ingesting = state === 'live' && rate > 0;

  return (
    <div className="lnd">
      <div className="lnd-grid" aria-hidden="true" />
      <div className="lnd-glow" aria-hidden="true" />

      <button
        className="theme-toggle landing-theme-toggle"
        onClick={onToggleTheme}
        title="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <main className="lnd-content">
        <div className="lnd-eyebrow" style={{ animationDelay: '60ms' }}>
          <span className={`lnd-dot lnd-dot-${ingesting ? 'live' : state}`} />
          {state === 'loading' && 'CONNECTING'}
          {state === 'offline' && 'ENGINE OFFLINE'}
          {state === 'live' && (ingesting ? `INGESTING ${fmt(rate)}/min` : 'WAREHOUSE ONLINE · MARKET CLOSED')}
          <span className="lnd-eyebrow-sep">/</span>
          {tickers ? `${tickers} INSTRUMENTS` : 'NSE EQUITIES'}
        </div>

        <h1 className="lnd-title" style={{ animationDelay: '120ms' }}>
          TradeRetro
        </h1>

        <p className="lnd-thesis" style={{ animationDelay: '200ms' }}>
          Most retail strategies don’t lose to the market.
          <br />
          <em>They lose to costs.</em>
        </p>

        <p className="lnd-desc" style={{ animationDelay: '280ms' }}>
          A streaming NSE data warehouse and an event-driven backtester that charges
          every fill the real Indian cost stack — STT, brokerage, GST, stamp duty and
          slippage — so a strategy’s edge is measured after the friction that removes it.
        </p>

        <div className="lnd-funnel" style={{ animationDelay: '360ms' }}>
          <Stage
            tier="bronze" value={fmt(bronze)} label="raw ticks"
            sub={instruments ? `${instruments} instruments` : null} delay={380}
          />
          <Stage tier="silver" value={fmt(silver)} label="1-min OHLCV" sub="deduped · gap-healed" delay={430} />
          <Stage tier="gold" value={fmt(gold)} label="5-min rollup" sub="continuous aggregate" delay={480} />
          <Stage tier="warehouse" value={fmt(warehouse)} label="EOD bars" sub="10 years, quality-gated" delay={530} />
        </div>

        <button className="lnd-cta" onClick={onEnter} style={{ animationDelay: '600ms' }}>
          <span>Launch Terminal</span>
          <ArrowRight size={17} />
        </button>

        <div className="lnd-foot" style={{ animationDelay: '680ms' }}>
          <span>TimescaleDB</span>
          <span>Redis Streams</span>
          <span>Prefect</span>
          <span>FastAPI</span>
          <span>React</span>
          <span className="lnd-foot-ver">v0.4</span>
        </div>
      </main>
    </div>
  );
}
