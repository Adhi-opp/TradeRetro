import { Sun, Moon, ArrowRight } from 'lucide-react';
import PRODUCT from '../constants/product';

/**
 * Ambient horizon: a strategy curve against its benchmark, drawn once at
 * module load and held still. It is the shape the product actually produces,
 * so it carries the subject rather than decorating it, and it gives the lower
 * half of the page something to sit on now that the stat cards are gone.
 */
function buildWalk(seed, n, drift, start) {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const pts = [];
  let v = start;
  for (let i = 0; i < n; i += 1) {
    v += (rnd() - drift) * 0.055;
    v = Math.max(0.06, Math.min(0.94, v));
    pts.push([(i / (n - 1)) * 1440, 320 - v * 320]);
  }
  return pts;
}

/** Quadratic midpoint smoothing, so the walk reads as a price series. */
function toPath(pts) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    d += ` Q${x0.toFixed(1)} ${y0.toFixed(1)} ${((x0 + x1) / 2).toFixed(1)} ${((y0 + y1) / 2).toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
  return d;
}

const STRATEGY = toPath(buildWalk(20180101, 96, 0.455, 0.34));
const BENCHMARK = toPath(buildWalk(77447731, 96, 0.44, 0.30));

function Horizon() {
  return (
    <svg
      className="lnd-horizon"
      viewBox="0 0 1440 320"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="lnd-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${BENCHMARK} L1440 320 L0 320 Z`} fill="none" />
      <path className="lnd-horizon-bench" d={BENCHMARK} />
      <path d={`${STRATEGY} L1440 320 L0 320 Z`} fill="url(#lnd-fill)" stroke="none" />
      <path className="lnd-horizon-strat" d={STRATEGY} />
    </svg>
  );
}

export default function Landing({ onEnter, theme, onToggleTheme }) {
  return (
    <div className="lnd">
      <div className="lnd-grid" aria-hidden="true" />
      <div className="lnd-glow" aria-hidden="true" />
      <Horizon />

      <button
        className="theme-toggle landing-theme-toggle"
        onClick={onToggleTheme}
        title="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <main className="lnd-content">
        <h1 className="lnd-title" style={{ animationDelay: '60ms' }}>
          TradeRetro
        </h1>

        <p className="lnd-thesis" style={{ animationDelay: '150ms' }}>
          See what your strategy actually kept.
        </p>

        <p className="lnd-desc" style={{ animationDelay: '240ms' }}>
          Ten years of NSE prices behind a streaming warehouse, and a backtest engine
          that pays STT, brokerage, GST, stamp duty and slippage on every fill.
          No frictionless maths, no trading on tomorrow&rsquo;s close.
        </p>

        <button className="lnd-cta" onClick={onEnter} style={{ animationDelay: '340ms' }}>
          <span>Launch Terminal</span>
          <ArrowRight size={17} />
        </button>

        <div className="lnd-foot" style={{ animationDelay: '430ms' }}>
          <span>TimescaleDB</span>
          <span>Redis Streams</span>
          <span>Prefect</span>
          <span>FastAPI</span>
          <span>React</span>
          <span className="lnd-foot-ver">{PRODUCT.version}</span>
        </div>
      </main>
    </div>
  );
}
