import { create } from 'zustand';

const API_BASE = 'http://localhost:8000';
const TIMEOUT_MS = 30000;

function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

function getErrorMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.message) return data.message;
  if (data.error && typeof data.error === 'string') return data.error;
  if (typeof data.detail === 'string') return data.detail;
  if (data.detail?.message) return data.detail.message;
  return fallback;
}

// Map flat UI config → the per-strategy params object the API expects.
// Risk params are entered as percentages in the UI (2 = 2%) and converted
// to fractions (0.02) for the engine.
function buildParams(s) {
  const capital = Number(s.capital) || 100000;
  const base = { initialCapital: capital };

  if (s.riskEnabled) {
    base.riskPct = Number(s.riskPct) / 100;
    base.stopLossPct = Number(s.stopLossPct) / 100;
  }

  const byStrategy = {
    MOVING_AVERAGE_CROSSOVER: { shortPeriod: Number(s.fastSma), longPeriod: Number(s.slowSma) },
    RSI: { rsiPeriod: Number(s.rsiPeriod), oversold: Number(s.oversold), overbought: Number(s.overbought) },
    MACD: {},
    BOLLINGER_BREAKOUT: { bbPeriod: Number(s.bbPeriod), bbStdDev: Number(s.bbStdDev) },
    DONCHIAN_BREAKOUT: { dcPeriod: Number(s.dcPeriod) },
  };

  return { ...base, ...(byStrategy[s.strategyType] || {}) };
}

const useBacktestStore = create((set, get) => ({
  // ── Global params (ControlBar) ────────────────────────────
  ticker: 'RELIANCE.NS',
  startDate: '2024-09-01',
  endDate: new Date().toISOString().split('T')[0],
  capital: 100000,
  applyCosts: false,

  // ── Strategy + params (StrategyConfig) ────────────────────
  strategyType: 'MOVING_AVERAGE_CROSSOVER',
  fastSma: 20,
  slowSma: 50,
  rsiPeriod: 14,
  oversold: 30,
  overbought: 70,
  bbPeriod: 20,
  bbStdDev: 2.0,
  dcPeriod: 20,

  // ── Risk model ────────────────────────────────────────────
  riskEnabled: false,
  riskPct: 2,        // % of equity risked per trade
  stopLossPct: 8,    // % adverse move = stop

  // ── Result state ──────────────────────────────────────────
  result: null,
  loading: false,
  error: null,
  // Snapshot of what produced `result` — charts/overlays read these so they
  // don't change when the form is edited but not yet re-run.
  ranTicker: null,
  ranRange: null,
  ranStrategyParams: null,

  // ── Actions ───────────────────────────────────────────────
  set: (patch) => set(patch),

  toggleCosts: () => set((s) => ({ applyCosts: !s.applyCosts })),

  runBacktest: async () => {
    const s = get();
    set({ loading: true, error: null, result: null });

    const payload = {
      symbol: (s.ticker || '').toUpperCase(),
      strategyType: s.strategyType,
      params: buildParams(s),
      startDate: s.startDate,
      endDate: s.endDate,
    };

    try {
      const res = await fetchWithTimeout(
        `${API_BASE}/api/backtest`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        TIMEOUT_MS,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(getErrorMessage(data, 'Backend rejected the request'));

      set({
        result: data,
        ranTicker: payload.symbol,
        ranRange: { startDate: s.startDate, endDate: s.endDate },
        ranStrategyParams: {
          strategyType: s.strategyType,
          fastSma: s.fastSma,
          slowSma: s.slowSma,
          rsiPeriod: s.rsiPeriod,
          oversold: s.oversold,
          overbought: s.overbought,
          bbPeriod: s.bbPeriod,
          bbStdDev: s.bbStdDev,
          dcPeriod: s.dcPeriod,
          riskEnabled: s.riskEnabled,
          riskPct: s.riskPct,
          stopLossPct: s.stopLossPct,
        },
      });
    } catch (err) {
      const msg = err.name === 'AbortError'
        ? 'Request timed out — the server took too long to respond'
        : (err.message || 'Failed to connect to the server');
      set({ error: msg });
    } finally {
      set({ loading: false });
    }
  },
}));

export default useBacktestStore;
