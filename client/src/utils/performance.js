// Client-side performance analytics derived from the backtest response.
// All inputs are the existing equityCurve / trades arrays that the Python
// engine already returns - no backend change required.

const TRADING_DAYS = 252;

function dailyReturns(curve) {
  const out = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1].equity;
    const curr = curve[i].equity;
    if (prev > 0) out.push({ date: curve[i].date, ret: curr / prev - 1 });
  }
  return out;
}

function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

function drawdownSeries(curve) {
  let peak = curve[0]?.equity ?? 0;
  return curve.map((p) => {
    peak = Math.max(peak, p.equity);
    const dd = peak > 0 ? (p.equity - peak) / peak : 0;
    return { date: p.date, equity: p.equity, peak, drawdown: dd * 100 };
  });
}

function maxDrawdownDuration(ddSeries) {
  let inDD = false;
  let start = null;
  let worstDays = 0;
  for (let i = 0; i < ddSeries.length; i++) {
    if (ddSeries[i].drawdown < 0) {
      if (!inDD) { inDD = true; start = i; }
    } else if (inDD) {
      worstDays = Math.max(worstDays, i - start);
      inDD = false;
    }
  }
  if (inDD) worstDays = Math.max(worstDays, ddSeries.length - start);
  return worstDays;
}

function monthlyReturns(curve) {
  // Build map of YYYY-MM -> [firstEquity, lastEquity]
  const byMonth = new Map();
  curve.forEach((p) => {
    const key = p.date.slice(0, 7);
    const existing = byMonth.get(key);
    if (!existing) byMonth.set(key, { first: p.equity, last: p.equity });
    else existing.last = p.equity;
  });

  const rows = Array.from(byMonth.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([ym, v]) => {
      const [y, m] = ym.split('-').map(Number);
      return {
        year: y,
        month: m,
        ret: v.first > 0 ? (v.last / v.first - 1) * 100 : 0,
      };
    });

  // Group into { year: [12 months with null gaps] }
  const years = {};
  rows.forEach((r) => {
    if (!years[r.year]) years[r.year] = Array(12).fill(null);
    years[r.year][r.month - 1] = r.ret;
  });

  return { years, rows };
}

function rollingSharpe(returns, window = 60) {
  const out = [];
  for (let i = window - 1; i < returns.length; i++) {
    const slice = returns.slice(i - window + 1, i + 1).map((r) => r.ret);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const sd = stdev(slice);
    const ann = sd > 0 ? (mean / sd) * Math.sqrt(TRADING_DAYS) : 0;
    out.push({ date: returns[i].date, sharpe: ann });
  }
  return out;
}

function returnHistogram(returns, buckets = 30) {
  if (!returns.length) return { bins: [], mean: 0, var95: 0 };
  const pct = returns.map((r) => r.ret * 100);
  const min = Math.min(...pct);
  const max = Math.max(...pct);
  const size = (max - min) / buckets || 1;
  const bins = Array.from({ length: buckets }, (_, i) => ({
    label: (min + i * size).toFixed(1),
    mid: min + (i + 0.5) * size,
    count: 0,
  }));
  pct.forEach((v) => {
    const idx = Math.min(Math.floor((v - min) / size), buckets - 1);
    bins[idx].count++;
  });
  const mean = pct.reduce((a, b) => a + b, 0) / pct.length;
  const sorted = [...pct].sort((a, b) => a - b);
  const var95 = sorted[Math.floor(sorted.length * 0.05)] ?? 0;
  return { bins, mean, var95 };
}

function tradeAnalytics(trades, applyCosts = true) {
  if (!trades || !trades.length) return null;

  const closed = trades.filter((t) => t.exitDate);
  const pnl = (t) => (applyCosts ? t.profitLoss : t.grossProfitLoss ?? t.profitLoss);
  const isWin = (t) => (applyCosts ? t.isWin : t.isGrossWin ?? pnl(t) > 0);

  const wins = closed.filter(isWin);
  const losses = closed.filter((t) => !isWin(t));
  const totalWinPnl = wins.reduce((a, t) => a + pnl(t), 0);
  const totalLossPnl = Math.abs(losses.reduce((a, t) => a + pnl(t), 0));

  let streakWin = 0, streakLoss = 0, curWin = 0, curLoss = 0;
  closed.forEach((t) => {
    if (isWin(t)) { curWin++; curLoss = 0; streakWin = Math.max(streakWin, curWin); }
    else { curLoss++; curWin = 0; streakLoss = Math.max(streakLoss, curLoss); }
  });

  const pnls = closed.map(pnl);
  const best = pnls.length ? Math.max(...pnls) : 0;
  const worst = pnls.length ? Math.min(...pnls) : 0;
  const avgWin = wins.length ? totalWinPnl / wins.length : 0;
  const avgLoss = losses.length ? totalLossPnl / losses.length : 0;
  const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : (totalWinPnl > 0 ? 99 : 0);
  const expectancy = closed.length ? pnls.reduce((a, b) => a + b, 0) / closed.length : 0;
  const avgHold = closed.length
    ? closed.reduce((a, t) => a + (t.holdingPeriod || 0), 0) / closed.length
    : 0;

  return {
    total: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    profitFactor,
    expectancy,
    avgWin,
    avgLoss,
    payoffRatio: avgLoss > 0 ? avgWin / avgLoss : 0,
    best,
    worst,
    streakWin,
    streakLoss,
    avgHold,
  };
}

export function analyze(result, applyCosts = true) {
  if (!result || !result.equityCurve || !result.equityCurve.length) return null;
  const curve = result.equityCurve;
  const rets = dailyReturns(curve);
  const dd = drawdownSeries(curve);

  const daily = rets.map((r) => r.ret);
  const negDaily = daily.filter((r) => r < 0);
  const meanDaily = daily.length ? daily.reduce((a, b) => a + b, 0) / daily.length : 0;
  const sdDaily = stdev(daily);
  const downDev = stdev(negDaily);

  const annReturn = meanDaily * TRADING_DAYS;
  const annVol = sdDaily * Math.sqrt(TRADING_DAYS);
  const sortino = downDev > 0 ? (meanDaily * TRADING_DAYS) / (downDev * Math.sqrt(TRADING_DAYS)) : 0;

  const maxDDpct = Math.min(...dd.map((p) => p.drawdown));
  const calmar = maxDDpct < 0 ? (result.metrics.cagr ?? annReturn * 100) / Math.abs(maxDDpct) : 0;
  const ddDuration = maxDrawdownDuration(dd);

  return {
    dailyReturns: rets,
    drawdown: dd,
    monthly: monthlyReturns(curve),
    rollingSharpe: rollingSharpe(rets, 60),
    histogram: returnHistogram(rets),
    trades: tradeAnalytics(result.trades, applyCosts),
    annReturn: annReturn * 100,
    annVol: annVol * 100,
    sortino,
    calmar,
    maxDDDurationDays: ddDuration,
    var95Daily: Math.abs(returnHistogram(rets).var95),
  };
}
