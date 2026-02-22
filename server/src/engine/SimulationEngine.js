/**
 * TradeRetro Simulation Engine
 * 
 * Core event-driven backtesting engine that processes historical data
 * sequentially to simulate portfolio state evolution.
 * 
 * Key Constraints:
 * - No look-ahead bias (only uses data available at time T)
 * - Executes trades at Close price of signal candle
 * - Applies 0.1% transaction fees
 * - Maintains chronological processing order
 */

const { SMA, RSI, MACD } = require('technicalindicators');

class SimulationEngine {
  /**
   * Initialize the simulation engine
   * @param {Array} ohlcData - Array of {date, open, high, low, close, volume, adjClose}
   * @param {number} initialCapital - Starting cash amount
   * @param {Object} strategyConfig - Strategy configuration {type, params}
   */
  constructor(ohlcData, initialCapital, strategyConfig) {
    // Validate inputs
    if (!Array.isArray(ohlcData) || ohlcData.length === 0) {
      throw new Error('Invalid OHLC data: must be non-empty array');
    }
    if (initialCapital <= 0) {
      throw new Error('Initial capital must be positive');
    }

    this.marketData = ohlcData;
    this.initialCapital = initialCapital;
    this.strategyConfig = strategyConfig;
    
    // Portfolio state
    this.cash = initialCapital;
    this.holdings = 0; // Number of shares currently held
    this.entryPrice = null;
    this.entryDate = null;
    
    // Results tracking
    this.trades = [];
    this.equityCurve = [];
    this.currentIndex = 0;
    
    // Fee structure
    this.transactionFeeRate = 0.001; // 0.1% per trade
    
    // Risk tracking
    this.highWaterMark = initialCapital;
    this.maxDrawdown = 0;
  }

  /**
   * Main simulation loop - processes data chronologically
   * @returns {Object} Complete backtest results
   */
  async run() {
    console.log(`🚀 Starting backtest: ${this.marketData.length} candles`);
    console.log(`💰 Initial capital: $${this.initialCapital}`);
    
    // Pre-calculate technical indicators for the entire dataset
    const closePrices = this.marketData.map(c => c.close);
    const indicators = this.calculateIndicators(closePrices);
    
    // Main event loop - iterate through each day
    for (let i = 0; i < this.marketData.length; i++) {
      this.currentIndex = i;
      const candle = this.marketData[i];
      
      // Step 1: Mark portfolio to market (calculate current value)
      const portfolioValue = this.calculatePortfolioValue(candle);
      
      // Step 2: Update equity curve
      this.equityCurve.push({
        date: candle.date,
        equity: portfolioValue,
        cash: this.cash,
        holdings: this.holdings,
        price: candle.close
      });
      
      // Step 3: Update drawdown tracking
      this.updateDrawdown(portfolioValue);
      
      // Step 4: Generate trading signal
      const signal = this.evaluateStrategy(candle, indicators, i);
      
      // Step 5: Execute trade if signal generated
      if (signal === 'BUY' && this.holdings === 0 && this.cash > 0) {
        this.executeBuy(candle);
      } else if (signal === 'SELL' && this.holdings > 0) {
        this.executeSell(candle);
      }
    }
    
    // Force close any open position at end of backtest
    if (this.holdings > 0) {
      const lastCandle = this.marketData[this.marketData.length - 1];
      this.executeSell(lastCandle, true); // Force close
    }
    
    // Generate final report
    return this.generateReport();
  }

  /**
   * Calculate technical indicators for the entire dataset.
   * Dispatches to the appropriate indicator calculator based on strategy type.
   *
   * @param {Array} closePrices - Array of closing prices (oldest first)
   * @returns {Object} Calculated indicators
   */
  calculateIndicators(closePrices) {
    const { strategyType } = this.strategyConfig;

    if (strategyType === 'MOVING_AVERAGE_CROSSOVER') {
      const { shortPeriod, longPeriod } = this.strategyConfig.params;
      const shortSMA = SMA.calculate({ period: shortPeriod, values: closePrices });
      const longSMA  = SMA.calculate({ period: longPeriod,  values: closePrices });
      return {
        shortSMA,
        longSMA,
        shortOffset: shortPeriod - 1,
        longOffset:  longPeriod  - 1
      };
    }

    if (strategyType === 'RSI') {
      const { rsiPeriod } = this.strategyConfig.params;
      const rsiValues = RSI.calculate({ period: rsiPeriod, values: closePrices });
      return {
        rsi: rsiValues,
        rsiOffset: rsiPeriod // RSI produces (n - period) values
      };
    }

    if (strategyType === 'MACD') {
      const macdValues = MACD.calculate({
        values: closePrices,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
      });
      return {
        macd: macdValues,
        macdOffset: closePrices.length - macdValues.length
      };
    }

    throw new Error(`Unknown strategy type: ${strategyType}`);
  }

  /**
   * Evaluate strategy and generate trading signal
   * @param {Object} candle - Current candle data
   * @param {Object} indicators - Pre-calculated indicators
   * @param {number} index - Current index in data array
   * @returns {string} 'BUY', 'SELL', or 'HOLD'
   */
  evaluateStrategy(candle, indicators, index) {
    const { strategyType } = this.strategyConfig;
    
    if (strategyType === 'MOVING_AVERAGE_CROSSOVER') {
      return this.evaluateMovingAverageCrossover(indicators, index);
    }
    if (strategyType === 'RSI') {
      return this.evaluateRSI(indicators, index);
    }
    if (strategyType === 'MACD') {
      return this.evaluateMACD(indicators, index);
    }

    throw new Error(`Unknown strategy type: ${strategyType}`);
  }

  /**
   * Moving Average Crossover strategy logic.
   * BUY  (Golden Cross): short MA crosses ABOVE long MA
   * SELL (Death Cross):  short MA crosses BELOW long MA
   *
   * Both SMAs are aligned so they END at the current candle, matching
   * standard trading convention (recent prices weighted correctly).
   */
  evaluateMovingAverageCrossover(indicators, index) {
    const { shortSMA, longSMA, shortOffset, longOffset } = indicators;

    // Need enough history for the slower (long) SMA
    if (index < longOffset) {
      return 'HOLD';
    }

    // Each SMA ends at the current candle — correct trading alignment
    const currentShort = shortSMA[index - shortOffset];
    const currentLong  = longSMA[index  - longOffset];
    const prevShort    = shortSMA[index - shortOffset - 1];
    const prevLong     = longSMA[index  - longOffset  - 1];

    if (!currentShort || !currentLong || !prevShort || !prevLong) {
      return 'HOLD';
    }

    const goldenCross = prevShort <= prevLong && currentShort > currentLong;
    const deathCross  = prevShort >= prevLong && currentShort < currentLong;

    if (goldenCross) {
      console.log(`📈 GOLDEN CROSS detected on ${this.marketData[index].date}`);
      return 'BUY';
    }

    if (deathCross) {
      console.log(`📉 DEATH CROSS detected on ${this.marketData[index].date}`);
      return 'SELL';
    }

    return 'HOLD';
  }

  /**
   * RSI strategy logic.
   * BUY when RSI drops below oversold threshold.
   * SELL when RSI rises above overbought threshold.
   */
  evaluateRSI(indicators, index) {
    const { rsi, rsiOffset } = indicators;
    const { oversold, overbought } = this.strategyConfig.params;

    const rsiIdx = index - rsiOffset;
    if (rsiIdx < 0 || rsi[rsiIdx] === undefined) {
      return 'HOLD';
    }

    const currentRSI = rsi[rsiIdx];

    if (currentRSI < oversold) {
      console.log(`📈 RSI OVERSOLD (${currentRSI.toFixed(2)}) on ${this.marketData[index].date}`);
      return 'BUY';
    }
    if (currentRSI > overbought) {
      console.log(`📉 RSI OVERBOUGHT (${currentRSI.toFixed(2)}) on ${this.marketData[index].date}`);
      return 'SELL';
    }

    return 'HOLD';
  }

  /**
   * MACD strategy logic.
   * BUY when MACD histogram crosses above zero (bullish momentum).
   * SELL when MACD histogram crosses below zero (bearish momentum).
   */
  evaluateMACD(indicators, index) {
    const { macd, macdOffset } = indicators;

    const macdIdx = index - macdOffset;
    if (macdIdx < 1) return 'HOLD';

    const current = macd[macdIdx];
    const prev    = macd[macdIdx - 1];

    if (!current || !prev || current.MACD === undefined || current.signal === undefined ||
        prev.MACD === undefined || prev.signal === undefined) {
      return 'HOLD';
    }

    const currentHist = current.MACD - current.signal;
    const prevHist    = prev.MACD - prev.signal;

    if (prevHist <= 0 && currentHist > 0) {
      console.log(`📈 MACD BULLISH CROSS on ${this.marketData[index].date}`);
      return 'BUY';
    }
    if (prevHist >= 0 && currentHist < 0) {
      console.log(`📉 MACD BEARISH CROSS on ${this.marketData[index].date}`);
      return 'SELL';
    }

    return 'HOLD';
  }

  /**
   * Execute a BUY order
   * @param {Object} candle - Current candle data
   */
  executeBuy(candle) {
    // Calculate how many shares we can afford including the transaction fee
    const price = candle.close;
    const maxShares = Math.floor(this.cash / (price * (1 + this.transactionFeeRate)));
    
    if (maxShares === 0) {
      console.log(`⚠️  Insufficient cash to buy at $${price}`);
      return;
    }
    
    // Calculate costs
    const tradeCost = maxShares * price;
    const transactionFee = tradeCost * this.transactionFeeRate;
    const totalCost = tradeCost + transactionFee;
    
    // Verify we have enough cash
    if (totalCost > this.cash) {
      console.log(`⚠️  Insufficient cash for transaction (need $${totalCost}, have $${this.cash})`);
      return;
    }
    
    // Update portfolio state
    this.cash -= totalCost;
    this.holdings = maxShares;
    this.entryPrice = price;
    this.entryDate = candle.date;
    
    console.log(`✅ BUY: ${maxShares} shares @ $${price.toFixed(2)} on ${candle.date} | Fee: $${transactionFee.toFixed(2)}`);
  }

  /**
   * Execute a SELL order
   * @param {Object} candle - Current candle data
   * @param {boolean} forceClose - Whether this is a forced position close
   */
  executeSell(candle, forceClose = false) {
    if (this.holdings === 0) {
      console.log(`⚠️  No position to sell`);
      return;
    }
    
    const price = candle.close;
    const proceeds = this.holdings * price;
    const transactionFee = proceeds * this.transactionFeeRate;
    const netProceeds = proceeds - transactionFee;
    
    // Calculate P&L for this trade
    const profitLoss = (price - this.entryPrice) * this.holdings - transactionFee;
    const profitLossPct = ((price - this.entryPrice) / this.entryPrice) * 100;
    const holdingPeriod = this.calculateDaysBetween(this.entryDate, candle.date);
    
    // Record trade
    this.trades.push({
      type: 'LONG',
      entryDate: this.entryDate,
      entryPrice: this.entryPrice,
      exitDate: candle.date,
      exitPrice: price,
      shares: this.holdings,
      profitLoss: profitLoss,
      pnlPct: profitLossPct,
      holdingPeriod: holdingPeriod,
      fee: transactionFee,
      isWin: profitLoss > 0,
      forceClose: forceClose
    });
    
    // Update portfolio
    this.cash += netProceeds;
    this.holdings = 0;
    this.entryPrice = null;
    this.entryDate = null;
    
    const emoji = profitLoss > 0 ? '💰' : '📛';
    console.log(`${emoji} SELL: ${this.trades[this.trades.length - 1].shares} shares @ $${price.toFixed(2)} on ${candle.date}`);
    console.log(`   P&L: $${profitLoss.toFixed(2)} (${this.trades[this.trades.length - 1].pnlPct.toFixed(2)}%) | Held ${holdingPeriod} days`);
  }

  /**
   * Calculate current portfolio value (mark to market)
   */
  calculatePortfolioValue(candle) {
    const positionValue = this.holdings * candle.close;
    return this.cash + positionValue;
  }

  /**
   * Update maximum drawdown tracking
   */
  updateDrawdown(currentValue) {
    if (currentValue > this.highWaterMark) {
      this.highWaterMark = currentValue;
    }
    
    const drawdown = (currentValue - this.highWaterMark) / this.highWaterMark;
    
    if (drawdown < this.maxDrawdown) {
      this.maxDrawdown = drawdown;
    }
  }

  /**
   * Calculate days between two dates
   */
  calculateDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate Sharpe Ratio (risk-adjusted return)
   */
  calculateSharpeRatio() {
    if (this.equityCurve.length < 2) {
      return 0;
    }
    
    // Calculate daily returns
    const dailyReturns = [];
    for (let i = 1; i < this.equityCurve.length; i++) {
      const ret = (this.equityCurve[i].equity - this.equityCurve[i - 1].equity) 
                  / this.equityCurve[i - 1].equity;
      dailyReturns.push(ret);
    }
    
    // Calculate mean return
    const meanReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    
    // Calculate standard deviation
    const variance = dailyReturns.reduce((sum, r) => 
      sum + Math.pow(r - meanReturn, 2), 0) / dailyReturns.length;
    const stdDev = Math.sqrt(variance);
    
    // Handle edge case: no volatility
    if (stdDev === 0) {
      return 0;
    }
    
    // Annualize (252 trading days per year)
    const annualizedReturn = meanReturn * 252;
    const annualizedStdDev = stdDev * Math.sqrt(252);
    const riskFreeRate = 0.04; // 4% assumption
    
    return (annualizedReturn - riskFreeRate) / annualizedStdDev;
  }

  /**
   * Generate comprehensive backtest report
   */
  generateReport() {
    const finalValue = this.equityCurve[this.equityCurve.length - 1].equity;
    const totalReturn = ((finalValue - this.initialCapital) / this.initialCapital) * 100;
    
    // Calculate win rate
    const winningTrades = this.trades.filter(t => t.isWin).length;
    const winRate = this.trades.length > 0 
      ? (winningTrades / this.trades.length) * 100 
      : 0;
    
    // Calculate average trade metrics
    const avgProfitLoss = this.trades.length > 0
      ? this.trades.reduce((sum, t) => sum + t.profitLoss, 0) / this.trades.length
      : 0;
    
    const avgHoldingPeriod = this.trades.length > 0
      ? this.trades.reduce((sum, t) => sum + t.holdingPeriod, 0) / this.trades.length
      : 0;
    
    // Calculate buy-and-hold benchmark return
    const initialPrice = this.marketData[0].close;
    const finalPrice = this.marketData[this.marketData.length - 1].close;
    const buyHoldReturn = ((finalPrice - initialPrice) / initialPrice) * 100;
    
    const report = {
      // Summary metrics
      metrics: {
        initialCapital: this.initialCapital,
        finalValue: finalValue,
        totalReturn: totalReturn,
        totalReturnDollar: finalValue - this.initialCapital,
        buyHoldReturn: buyHoldReturn,
        sharpeRatio: this.calculateSharpeRatio(),
        maxDrawdown: this.maxDrawdown * 100, // Convert to percentage
        
        totalTrades: this.trades.length,
        winningTrades: winningTrades,
        losingTrades: this.trades.length - winningTrades,
        winRate: winRate,
        
        avgProfitLoss: avgProfitLoss,
        avgHoldingPeriod: avgHoldingPeriod,
        
        startDate: this.marketData[0].date,
        endDate: this.marketData[this.marketData.length - 1].date,
        totalDays: this.marketData.length
      },
      
      
      equityCurve: this.equityCurve,
      trades: this.trades,
      
      
      strategy: this.strategyConfig
    };
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 BACKTEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Initial Capital:     $${this.initialCapital.toFixed(2)}`);
    console.log(`Final Value:         $${finalValue.toFixed(2)}`);
    console.log(`Total Return:        ${totalReturn.toFixed(2)}%`);
    console.log(`Sharpe Ratio:        ${report.metrics.sharpeRatio.toFixed(2)}`);
    console.log(`Max Drawdown:        ${report.metrics.maxDrawdown.toFixed(2)}%`);
    console.log(`Total Trades:        ${this.trades.length}`);
    console.log(`Win Rate:            ${winRate.toFixed(2)}%`);
    console.log(`Avg P&L per Trade:   $${avgProfitLoss.toFixed(2)}`);
    console.log(`Avg Hold Period:     ${avgHoldingPeriod.toFixed(1)} days`);
    console.log('='.repeat(60) + '\n');
    
    return report;
  }
}

module.exports = SimulationEngine;
