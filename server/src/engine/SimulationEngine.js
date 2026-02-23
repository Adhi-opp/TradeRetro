/**
 * TradeRetro Simulation Engine
 *
 * Core event-driven backtesting engine that processes historical data
 * sequentially to simulate portfolio state evolution.
 *
 * Key Constraints:
 * - No look-ahead bias (only uses data available at time T)
 * - Executes trades at Close price of signal candle
 * - Configurable Indian transaction cost model (STT, brokerage, slippage)
 * - Maintains chronological processing order
 *
 * Cost Models:
 * - GROSS: Flat 0.1% fee per trade (default)
 * - INDIA_EQUITY: STT + brokerage + slippage + exchange fees
 */

const { SMA, RSI, MACD } = require('technicalindicators');

// ── Indian Transaction Cost Model ────────────────────────────────────────────
const INDIA_EQUITY_COSTS = {
  stt_delivery_buy:  0.001,    // 0.1% STT on buy (delivery)
  stt_delivery_sell: 0.001,    // 0.1% STT on sell (delivery)
  brokerage:         0.0003,   // 0.03% flat brokerage (discount broker)
  exchange_txn:      0.0000345,// NSE transaction charge
  gst:               0.18,     // 18% GST on brokerage + exchange charges
  sebi_fee:          0.000001, // SEBI turnover fee
  stamp_duty_buy:    0.00015,  // 0.015% stamp duty on buy
  slippage_mean:     0.001,    // 0.1% average slippage
  slippage_std:      0.0005,   // slippage variability
};

function calculateIndianCosts(tradeValue, side, rng) {
  const c = INDIA_EQUITY_COSTS;

  let stt = 0;
  let stampDuty = 0;

  if (side === 'BUY') {
    stt = tradeValue * c.stt_delivery_buy;
    stampDuty = tradeValue * c.stamp_duty_buy;
  } else {
    stt = tradeValue * c.stt_delivery_sell;
  }

  const brokerage = tradeValue * c.brokerage;
  const exchangeTxn = tradeValue * c.exchange_txn;
  const gst = (brokerage + exchangeTxn) * c.gst;
  const sebiFee = tradeValue * c.sebi_fee;

  // Slippage: random based on normal distribution
  let slippage = 0;
  if (rng) {
    const u1 = rng();
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
    slippage = Math.abs(z * c.slippage_std + c.slippage_mean) * tradeValue;
  } else {
    slippage = c.slippage_mean * tradeValue;
  }

  const total = stt + brokerage + exchangeTxn + gst + sebiFee + stampDuty + slippage;

  return { stt, brokerage, exchangeTxn, gst, sebiFee, stampDuty, slippage, total };
}

// ── Seeded RNG ───────────────────────────────────────────────────────────────
function createSeededRng(seed) {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class SimulationEngine {
  constructor(ohlcData, initialCapital, strategyConfig) {
    if (!Array.isArray(ohlcData) || ohlcData.length === 0) {
      throw new Error('Invalid OHLC data: must be non-empty array');
    }
    if (initialCapital <= 0) {
      throw new Error('Initial capital must be positive');
    }

    this.marketData = ohlcData;
    this.initialCapital = initialCapital;
    this.strategyConfig = strategyConfig;

    // Always use INDIA_EQUITY cost model
    this.costModel = 'INDIA_EQUITY';

    // Deterministic seed
    const seed = strategyConfig.params.seed != null ? strategyConfig.params.seed : null;
    this.rng = seed != null ? createSeededRng(seed) : Math.random.bind(Math);
    this.seed = seed;

    // Portfolio state
    this.cash = initialCapital;
    this.holdings = 0;
    this.entryPrice = null;
    this.entryDate = null;

    // Results tracking
    this.trades = [];
    this.equityCurve = [];
    this.currentIndex = 0;

    // Cost tracking
    this.totalCosts = {
      stt: 0, brokerage: 0, slippage: 0, exchangeTxn: 0,
      gst: 0, sebiFee: 0, stampDuty: 0, grossTotal: 0,
    };

    // Risk tracking
    this.highWaterMark = initialCapital;
    this.maxDrawdown = 0;
    this.grossHighWaterMark = initialCapital;
    this.grossMaxDrawdown = 0;
  }

  async run() {
    const closePrices = this.marketData.map(c => c.close);
    const indicators = this.calculateIndicators(closePrices);

    for (let i = 0; i < this.marketData.length; i++) {
      this.currentIndex = i;
      const candle = this.marketData[i];
      const portfolioValue = this.calculatePortfolioValue(candle);

      const grossEquity = portfolioValue + this.totalCosts.grossTotal;

      this.equityCurve.push({
        date: candle.date,
        equity: portfolioValue,
        grossEquity,
        cash: this.cash,
        holdings: this.holdings,
        price: candle.close
      });

      this.updateDrawdown(portfolioValue);
      this.updateGrossDrawdown(grossEquity);

      const signal = this.evaluateStrategy(candle, indicators, i);

      if (signal === 'BUY' && this.holdings === 0 && this.cash > 0) {
        this.executeBuy(candle);
      } else if (signal === 'SELL' && this.holdings > 0) {
        this.executeSell(candle);
      }
    }

    if (this.holdings > 0) {
      const lastCandle = this.marketData[this.marketData.length - 1];
      this.executeSell(lastCandle, true);
    }

    return this.generateReport();
  }

  calculateIndicators(closePrices) {
    const { strategyType } = this.strategyConfig;

    if (strategyType === 'MOVING_AVERAGE_CROSSOVER') {
      const { shortPeriod, longPeriod } = this.strategyConfig.params;
      const shortSMA = SMA.calculate({ period: shortPeriod, values: closePrices });
      const longSMA  = SMA.calculate({ period: longPeriod,  values: closePrices });
      return { shortSMA, longSMA, shortOffset: shortPeriod - 1, longOffset: longPeriod - 1 };
    }

    if (strategyType === 'RSI') {
      const { rsiPeriod } = this.strategyConfig.params;
      const rsiValues = RSI.calculate({ period: rsiPeriod, values: closePrices });
      return { rsi: rsiValues, rsiOffset: rsiPeriod };
    }

    if (strategyType === 'MACD') {
      const macdValues = MACD.calculate({
        values: closePrices, fastPeriod: 12, slowPeriod: 26,
        signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false
      });
      return { macd: macdValues, macdOffset: closePrices.length - macdValues.length };
    }

    throw new Error(`Unknown strategy type: ${strategyType}`);
  }

  evaluateStrategy(candle, indicators, index) {
    const { strategyType } = this.strategyConfig;
    if (strategyType === 'MOVING_AVERAGE_CROSSOVER') return this.evaluateMovingAverageCrossover(indicators, index);
    if (strategyType === 'RSI') return this.evaluateRSI(indicators, index);
    if (strategyType === 'MACD') return this.evaluateMACD(indicators, index);
    throw new Error(`Unknown strategy type: ${strategyType}`);
  }

  evaluateMovingAverageCrossover(indicators, index) {
    const { shortSMA, longSMA, shortOffset, longOffset } = indicators;
    if (index < longOffset) return 'HOLD';

    const currentShort = shortSMA[index - shortOffset];
    const currentLong  = longSMA[index  - longOffset];
    const prevShort    = shortSMA[index - shortOffset - 1];
    const prevLong     = longSMA[index  - longOffset  - 1];

    if (!currentShort || !currentLong || !prevShort || !prevLong) return 'HOLD';

    if (prevShort <= prevLong && currentShort > currentLong) return 'BUY';
    if (prevShort >= prevLong && currentShort < currentLong) return 'SELL';
    return 'HOLD';
  }

  evaluateRSI(indicators, index) {
    const { rsi, rsiOffset } = indicators;
    const { oversold, overbought } = this.strategyConfig.params;
    const rsiIdx = index - rsiOffset;
    if (rsiIdx < 0 || rsi[rsiIdx] === undefined) return 'HOLD';
    if (rsi[rsiIdx] < oversold) return 'BUY';
    if (rsi[rsiIdx] > overbought) return 'SELL';
    return 'HOLD';
  }

  evaluateMACD(indicators, index) {
    const { macd, macdOffset } = indicators;
    const macdIdx = index - macdOffset;
    if (macdIdx < 1) return 'HOLD';

    const current = macd[macdIdx];
    const prev    = macd[macdIdx - 1];

    if (!current || !prev || current.MACD === undefined || current.signal === undefined ||
        prev.MACD === undefined || prev.signal === undefined) return 'HOLD';

    const currentHist = current.MACD - current.signal;
    const prevHist    = prev.MACD - prev.signal;

    if (prevHist <= 0 && currentHist > 0) return 'BUY';
    if (prevHist >= 0 && currentHist < 0) return 'SELL';
    return 'HOLD';
  }

  executeBuy(candle) {
    const price = candle.close;
    const approxCostRate = 0.003;
    const maxShares = Math.floor(this.cash / (price * (1 + approxCostRate)));
    if (maxShares === 0) return;

    const tradeValue = maxShares * price;
    const costs = calculateIndianCosts(tradeValue, 'BUY', this.rng);
    const totalCost = tradeValue + costs.total;
    if (totalCost > this.cash) return;

    this.totalCosts.stt += costs.stt;
    this.totalCosts.brokerage += costs.brokerage;
    this.totalCosts.slippage += costs.slippage;
    this.totalCosts.exchangeTxn += costs.exchangeTxn;
    this.totalCosts.gst += costs.gst;
    this.totalCosts.sebiFee += costs.sebiFee;
    this.totalCosts.stampDuty += costs.stampDuty;
    this.totalCosts.grossTotal += costs.total;

    this.cash -= totalCost;
    this.holdings = maxShares;
    this.entryPrice = price;
    this.entryDate = candle.date;
  }

  executeSell(candle, forceClose = false) {
    if (this.holdings === 0) return;

    const price = candle.close;
    const proceeds = this.holdings * price;

    const costs = calculateIndianCosts(proceeds, 'SELL', this.rng);
    const netProceeds = proceeds - costs.total;
    const totalFee = costs.total;

    this.totalCosts.stt += costs.stt;
    this.totalCosts.brokerage += costs.brokerage;
    this.totalCosts.slippage += costs.slippage;
    this.totalCosts.exchangeTxn += costs.exchangeTxn;
    this.totalCosts.gst += costs.gst;
    this.totalCosts.grossTotal += costs.total;

    const profitLoss = (price - this.entryPrice) * this.holdings - totalFee;
    const grossProfitLoss = (price - this.entryPrice) * this.holdings;
    const profitLossPct = ((price - this.entryPrice) / this.entryPrice) * 100;
    const holdingPeriod = this.calculateDaysBetween(this.entryDate, candle.date);

    this.trades.push({
      type: 'LONG',
      entryDate: this.entryDate,
      entryPrice: this.entryPrice,
      exitDate: candle.date,
      exitPrice: price,
      shares: this.holdings,
      profitLoss,
      grossProfitLoss,
      pnlPct: profitLossPct,
      holdingPeriod,
      fee: totalFee,
      isWin: profitLoss > 0,
      isGrossWin: grossProfitLoss > 0,
      forceClose
    });

    this.cash += netProceeds;
    this.holdings = 0;
    this.entryPrice = null;
    this.entryDate = null;
  }

  calculatePortfolioValue(candle) {
    return this.cash + this.holdings * candle.close;
  }

  updateDrawdown(currentValue) {
    if (currentValue > this.highWaterMark) this.highWaterMark = currentValue;
    const drawdown = (currentValue - this.highWaterMark) / this.highWaterMark;
    if (drawdown < this.maxDrawdown) this.maxDrawdown = drawdown;
  }

  updateGrossDrawdown(grossValue) {
    if (grossValue > this.grossHighWaterMark) this.grossHighWaterMark = grossValue;
    const drawdown = (grossValue - this.grossHighWaterMark) / this.grossHighWaterMark;
    if (drawdown < this.grossMaxDrawdown) this.grossMaxDrawdown = drawdown;
  }

  calculateDaysBetween(startDate, endDate) {
    return Math.ceil(Math.abs(new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
  }

  calculateSharpeRatio() {
    if (this.equityCurve.length < 2) return 0;

    const dailyReturns = [];
    for (let i = 1; i < this.equityCurve.length; i++) {
      dailyReturns.push(
        (this.equityCurve[i].equity - this.equityCurve[i - 1].equity) / this.equityCurve[i - 1].equity
      );
    }

    const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / dailyReturns.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return 0;

    const annReturn = mean * 252;
    const annStdDev = stdDev * Math.sqrt(252);
    const riskFreeRate = 0.065; // India 10Y ~6.5%

    return (annReturn - riskFreeRate) / annStdDev;
  }

  calculateCAGR() {
    if (this.equityCurve.length < 2) return 0;
    const finalValue = this.equityCurve[this.equityCurve.length - 1].equity;
    const years = this.marketData.length / 252;
    if (years <= 0) return 0;
    return (Math.pow(finalValue / this.initialCapital, 1 / years) - 1) * 100;
  }

  calculateBenchmarkCAGR() {
    const initialPrice = this.marketData[0].close;
    const finalPrice = this.marketData[this.marketData.length - 1].close;
    const years = this.marketData.length / 252;
    if (years <= 0) return 0;
    return (Math.pow(finalPrice / initialPrice, 1 / years) - 1) * 100;
  }

  calculateAlpha() {
    return this.calculateCAGR() - this.calculateBenchmarkCAGR();
  }

  calculateInformationRatio() {
    if (this.equityCurve.length < 2) return 0;

    const excessReturns = [];
    for (let i = 1; i < this.equityCurve.length; i++) {
      const stratReturn = (this.equityCurve[i].equity - this.equityCurve[i - 1].equity)
                          / this.equityCurve[i - 1].equity;
      const benchReturn = (this.marketData[i].close - this.marketData[i - 1].close)
                          / this.marketData[i - 1].close;
      excessReturns.push(stratReturn - benchReturn);
    }

    const mean = excessReturns.reduce((s, r) => s + r, 0) / excessReturns.length;
    const variance = excessReturns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / excessReturns.length;
    const trackingError = Math.sqrt(variance) * Math.sqrt(252);

    if (trackingError === 0) return 0;
    return (mean * 252) / trackingError;
  }

  generateReport() {
    const lastPoint = this.equityCurve.length > 0
      ? this.equityCurve[this.equityCurve.length - 1]
      : null;
    const finalValue = lastPoint ? lastPoint.equity : this.initialCapital;
    const grossFinalValue = lastPoint ? lastPoint.grossEquity : this.initialCapital;

    const totalReturn = ((finalValue - this.initialCapital) / this.initialCapital) * 100;
    const grossTotalReturn = ((grossFinalValue - this.initialCapital) / this.initialCapital) * 100;

    const winningTrades = this.trades.filter(t => t.isWin).length;
    const grossWinningTrades = this.trades.filter(t => t.isGrossWin).length;
    const winRate = this.trades.length > 0
      ? (winningTrades / this.trades.length) * 100
      : 0;
    const grossWinRate = this.trades.length > 0
      ? (grossWinningTrades / this.trades.length) * 100
      : 0;

    const avgProfitLoss = this.trades.length > 0
      ? this.trades.reduce((sum, t) => sum + t.profitLoss, 0) / this.trades.length
      : 0;

    const avgHoldingPeriod = this.trades.length > 0
      ? this.trades.reduce((sum, t) => sum + t.holdingPeriod, 0) / this.trades.length
      : 0;

    const initialPrice = this.marketData[0].close;
    const finalPrice = this.marketData[this.marketData.length - 1].close;
    const buyHoldReturn = ((finalPrice - initialPrice) / initialPrice) * 100;

    // Gross CAGR (using grossEquity curve)
    const years = this.marketData.length / 252;
    const grossCagr = years > 0 ? (Math.pow(grossFinalValue / this.initialCapital, 1 / years) - 1) * 100 : 0;

    return {
      // Net metrics (after Indian transaction costs)
      metrics: {
        initialCapital: this.initialCapital,
        finalValue,
        totalReturn,
        totalReturnRupee: finalValue - this.initialCapital,
        buyHoldReturn,
        sharpeRatio: this.calculateSharpeRatio(),
        maxDrawdown: this.maxDrawdown * 100,

        cagr: this.calculateCAGR(),
        benchmarkCagr: this.calculateBenchmarkCAGR(),
        alpha: this.calculateAlpha(),
        informationRatio: this.calculateInformationRatio(),

        totalTrades: this.trades.length,
        winningTrades,
        losingTrades: this.trades.length - winningTrades,
        winRate,
        avgProfitLoss,
        avgHoldingPeriod,

        startDate: this.marketData[0].date,
        endDate: this.marketData[this.marketData.length - 1].date,
        totalDays: this.marketData.length
      },

      // Gross metrics (before costs — for toggle display)
      grossMetrics: {
        finalValue: grossFinalValue,
        totalReturn: grossTotalReturn,
        totalReturnRupee: grossFinalValue - this.initialCapital,
        maxDrawdown: this.grossMaxDrawdown * 100,
        cagr: grossCagr,
        alpha: grossCagr - this.calculateBenchmarkCAGR(),
        winRate: grossWinRate,
        winningTrades: grossWinningTrades,
      },

      costBreakdown: {
        stt: Math.round(this.totalCosts.stt * 100) / 100,
        brokerage: Math.round(this.totalCosts.brokerage * 100) / 100,
        slippage: Math.round(this.totalCosts.slippage * 100) / 100,
        exchangeFees: Math.round(this.totalCosts.exchangeTxn * 100) / 100,
        gst: Math.round(this.totalCosts.gst * 100) / 100,
        stampDuty: Math.round(this.totalCosts.stampDuty * 100) / 100,
        totalCosts: Math.round(this.totalCosts.grossTotal * 100) / 100,
        costPctOfCapital: Math.round((this.totalCosts.grossTotal / this.initialCapital) * 10000) / 100,
      },

      equityCurve: this.equityCurve,
      trades: this.trades,
      strategy: this.strategyConfig,

      simulationMeta: {
        dataSource: 'synthetic_regime_switching',
        regimeModel: '3_state_markov',
        costModel: 'INDIA_EQUITY',
        seed: this.seed,
        transactionCostModel: 'india_equity_v1',
      }
    };
  }
}

module.exports = SimulationEngine;
