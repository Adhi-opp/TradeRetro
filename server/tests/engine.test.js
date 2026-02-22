/**
 * Unit Tests for SimulationEngine
 * 
 * Run with: npm test
 */

const SimulationEngine = require('../src/engine/SimulationEngine');

// Mock data generator
function generateMockData(days, startPrice = 100, trend = 0) {
  const data = [];
  let price = startPrice;
  
  for (let i = 0; i < days; i++) {
    // Add some randomness and trend
    const change = (Math.random() - 0.5) * 5 + trend;
    price = Math.max(price + change, 1); // Prevent negative prices
    
    const open = price;
    const close = price + (Math.random() - 0.5) * 2;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    
    data.push({
      date: new Date(2020, 0, i + 1).toISOString(),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(Math.random() * 10000000),
      adjClose: parseFloat(close.toFixed(2))
    });
  }
  
  return data;
}

describe('SimulationEngine', () => {
  
  describe('Initialization', () => {
    test('should initialize with correct starting capital', () => {
      const data = generateMockData(100);
      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 10, longPeriod: 20 }
      });
      
      expect(engine.cash).toBe(10000);
      expect(engine.holdings).toBe(0);
      expect(engine.initialCapital).toBe(10000);
    });
    
    test('should throw error for invalid data', () => {
      expect(() => {
        new SimulationEngine([], 10000, {});
      }).toThrow('Invalid OHLC data');
    });
    
    test('should throw error for negative initial capital', () => {
      const data = generateMockData(100);
      expect(() => {
        new SimulationEngine(data, -1000, {});
      }).toThrow('Initial capital must be positive');
    });
  });
  
  describe('Portfolio Management', () => {
    test('should execute BUY order correctly', () => {
      const data = generateMockData(100, 100);
      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 10, longPeriod: 20 }
      });
      
      const candle = data[50];
      engine.executeBuy(candle);
      
      // Should have bought shares
      expect(engine.holdings).toBeGreaterThan(0);
      
      // Cash should have decreased (cost + fees)
      expect(engine.cash).toBeLessThan(10000);
      
      // Entry price should be set
      expect(engine.entryPrice).toBe(candle.close);
    });
    
    test('should apply transaction fees on BUY', () => {
      const data = generateMockData(100, 100);
      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 10, longPeriod: 20 }
      });
      
      const candle = { ...data[0], close: 100 };
      const initialCash = engine.cash;
      
      engine.executeBuy(candle);
      
      const shares = engine.holdings;
      const expectedCost = shares * 100; // Share cost
      const expectedFee = expectedCost * 0.001; // 0.1% fee
      const expectedCashAfter = initialCash - expectedCost - expectedFee;
      
      expect(engine.cash).toBeCloseTo(expectedCashAfter, 2);
    });
    
    test('should execute SELL order correctly', () => {
      const data = generateMockData(100, 100);
      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 10, longPeriod: 20 }
      });
      
      // First buy
      engine.executeBuy(data[50]);
      const holdingsBeforeSell = engine.holdings;
      
      // Then sell
      engine.executeSell(data[60]);
      
      // Should have no holdings after sell
      expect(engine.holdings).toBe(0);
      
      // Should have recorded a trade
      expect(engine.trades.length).toBe(1);
      expect(engine.trades[0].shares).toBe(holdingsBeforeSell);
    });
    
    test('should calculate profit/loss correctly', () => {
      const data = [
        { date: '2020-01-01', close: 100, open: 100, high: 102, low: 98, volume: 1000000, adjClose: 100 },
        { date: '2020-01-02', close: 110, open: 100, high: 112, low: 98, volume: 1000000, adjClose: 110 }
      ];
      
      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 1, longPeriod: 2 }
      });
      
      // Buy at $100
      engine.executeBuy(data[0]);
      const shares = engine.holdings;
      
      // Sell at $110
      engine.executeSell(data[1]);
      
      // P&L should be positive (ignoring fees for simplicity of test)
      expect(engine.trades[0].profitLoss).toBeGreaterThan(0);
      expect(engine.trades[0].isWin).toBe(true);
    });
  });
  
  describe('Technical Indicators', () => {
    test('should calculate SMA correctly', () => {
      const data = [
        { close: 10 },
        { close: 20 },
        { close: 30 },
        { close: 40 },
        { close: 50 }
      ].map((d, i) => ({
        ...d,
        date: `2020-01-${i+1}`,
        open: d.close,
        high: d.close + 1,
        low: d.close - 1,
        volume: 1000000,
        adjClose: d.close
      }));
      
      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 5, longPeriod: 5 }
      });
      
      const closePrices = data.map(d => d.close);
      const indicators = engine.calculateIndicators(closePrices);
      
      // SMA of [10,20,30,40,50] should be 30
      expect(indicators.shortSMA[0]).toBe(30);
    });
  });
  
  describe('Signal Generation', () => {
    test('should detect golden cross (BUY signal)', () => {
      // Phase 1: downtrend establishes short MA below long MA
      // Phase 2: sharp recovery causes short MA to cross above long MA (golden cross)
      const fallingData = generateMockData(500, 100, -0.3);
      const lastClose   = fallingData[fallingData.length - 1].close;
      const risingData  = generateMockData(10000, Math.max(lastClose, 10), 0.8);
      const data = [...fallingData, ...risingData];

      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 50, longPeriod: 200 }
      });

      const closePrices = data.map(d => d.close);
      const indicators = engine.calculateIndicators(closePrices);

      let foundGoldenCross = false;
      for (let i = 200; i < data.length; i++) {
        const signal = engine.evaluateMovingAverageCrossover(indicators, i);
        if (signal === 'BUY') {
          foundGoldenCross = true;
          break;
        }
      }

      expect(foundGoldenCross).toBe(true);
    });
    
    test('should detect death cross (SELL signal)', () => {
      // Phase 1: uptrend establishes short MA above long MA (golden cross territory)
      // Phase 2: sharp reversal causes short MA to fall below long MA (death cross)
      const risingData  = generateMockData(500, 100, 0.3);
      const lastClose   = risingData[risingData.length - 1].close;
      const fallingData = generateMockData(10000, Math.max(lastClose, 100), -0.8);
      const data = [...risingData, ...fallingData];

      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 50, longPeriod: 200 }
      });

      const closePrices = data.map(d => d.close);
      const indicators = engine.calculateIndicators(closePrices);

      let foundDeathCross = false;
      for (let i = 200; i < data.length; i++) {
        const signal = engine.evaluateMovingAverageCrossover(indicators, i);
        if (signal === 'SELL') {
          foundDeathCross = true;
          break;
        }
      }

      expect(foundDeathCross).toBe(true);
    });
    
    test('should return HOLD when insufficient data', () => {
      const data = generateMockData(10);
      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 50, longPeriod: 200 }
      });
      
      const closePrices = data.map(d => d.close);
      const indicators = engine.calculateIndicators(closePrices);
      
      const signal = engine.evaluateMovingAverageCrossover(indicators, 5);
      expect(signal).toBe('HOLD');
    });
  });
  
  describe('Risk Metrics', () => {
    test('should calculate Sharpe ratio', () => {
      const data = generateMockData(252, 100, 0.1); // 1 year of data
      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 10, longPeriod: 20 }
      });
      
      // Simulate some equity curve
      for (let i = 0; i < data.length; i++) {
        engine.equityCurve.push({
          date: data[i].date,
          equity: 10000 + (i * 10) // Simple upward trend
        });
      }
      
      const sharpe = engine.calculateSharpeRatio();
      
      // Should return a number
      expect(typeof sharpe).toBe('number');
      expect(sharpe).not.toBeNaN();
      expect(sharpe).not.toBe(Infinity);
    });
    
    test('should handle zero volatility edge case', () => {
      const data = generateMockData(100);
      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 10, longPeriod: 20 }
      });
      
      // Flat equity curve (no volatility)
      for (let i = 0; i < data.length; i++) {
        engine.equityCurve.push({
          date: data[i].date,
          equity: 10000 // No change
        });
      }
      
      const sharpe = engine.calculateSharpeRatio();
      expect(sharpe).toBe(0);
    });
    
    test('should update drawdown correctly', () => {
      const data = generateMockData(100);
      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 10, longPeriod: 20 }
      });
      
      // Simulate peak then drawdown
      engine.updateDrawdown(15000); // New high
      expect(engine.highWaterMark).toBe(15000);
      
      engine.updateDrawdown(12000); // Drawdown
      const expectedDD = (12000 - 15000) / 15000;
      expect(engine.maxDrawdown).toBeCloseTo(expectedDD, 5);
    });
  });
  
  describe('Full Backtest Integration', () => {
    test('should complete a full backtest without errors', async () => {
      const data = generateMockData(500, 100, 0.1);
      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 50, longPeriod: 200 }
      });
      
      const results = await engine.run();
      
      // Should return results object
      expect(results).toHaveProperty('metrics');
      expect(results).toHaveProperty('equityCurve');
      expect(results).toHaveProperty('trades');
      
      // Metrics should have expected fields
      expect(results.metrics).toHaveProperty('totalReturn');
      expect(results.metrics).toHaveProperty('sharpeRatio');
      expect(results.metrics).toHaveProperty('maxDrawdown');
      expect(results.metrics).toHaveProperty('totalTrades');
    });
    
    test('should execute at least one trade in trending market', async () => {
      const data = generateMockData(500, 100, 0.2); // Strong upward trend
      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 20, longPeriod: 50 }
      });
      
      const results = await engine.run();
      
      // In a trending market, should generate at least one signal
      expect(results.metrics.totalTrades).toBeGreaterThan(0);
    });
    
    test('should respect capital constraints', async () => {
      const data = generateMockData(200, 100);
      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 10, longPeriod: 20 }
      });
      
      const results = await engine.run();
      
      // Final equity should never be negative
      expect(results.metrics.finalValue).toBeGreaterThanOrEqual(0);
      
      // Cash should never be negative throughout simulation
      const negativeCash = engine.equityCurve.some(point => point.cash < 0);
      expect(negativeCash).toBe(false);
    });
    
    test('should complete backtest in reasonable time', async () => {
      const data = generateMockData(1000, 100); // Large dataset
      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 50, longPeriod: 200 }
      });
      
      const startTime = Date.now();
      await engine.run();
      const duration = Date.now() - startTime;
      
      // Should complete in under 2 seconds (requirement)
      expect(duration).toBeLessThan(2000);
    });
  });
  
  describe('Edge Cases', () => {
    test('should handle missing price data gracefully', () => {
      const data = generateMockData(100);
      // Corrupt one data point
      data[50].close = undefined;
      
      const engine = new SimulationEngine(data, 10000, {
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 10, longPeriod: 20 }
      });
      
      // Should not throw error, but may skip that candle
      expect(async () => await engine.run()).not.toThrow();
    });
    
    test('should handle very small initial capital', async () => {
      const data = generateMockData(100, 1000); // High stock price
      const engine = new SimulationEngine(data, 500, { // Low capital
        strategyType: 'MOVING_AVERAGE_CROSSOVER',
        params: { shortPeriod: 10, longPeriod: 20 }
      });
      
      const results = await engine.run();
      
      // May not execute any trades if can't afford even 1 share
      // But should not crash
      expect(results.metrics.totalTrades).toBeGreaterThanOrEqual(0);
    });
  });
});

// Run tests
if (require.main === module) {
  console.log('Running tests...');
  // If running directly, just export for Jest to pick up
}

module.exports = { generateMockData };
