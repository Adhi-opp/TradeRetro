/**
 * TradeRetro API Server
 *
 * Endpoints:
 * - GET  /api/health            - Health check
 * - GET  /api/assets            - List available symbols
 * - GET  /api/data/:symbol      - Historical price data
 * - POST /api/backtest          - Run a backtest simulation
 * - POST /api/validate-strategy - Dry-run payload validation
 * - POST /api/verify-ai-strategy - BS Detector (AI claim verification)
 * - GET  /api/bs-detector/stocks - Available NSE stocks
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const SimulationEngine = require('./engine/SimulationEngine');
const bsDetectorRoute = require('./routes/bsDetector');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/api', bsDetectorRoute);

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ── Database ──────────────────────────────────────────────────────────────────

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/traderetro')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

const marketDataSchema = new mongoose.Schema({
  symbol:   { type: String, required: true, index: true },
  date:     { type: Date,   required: true, index: true },
  open:     Number,
  high:     Number,
  low:      Number,
  close:    Number,
  volume:   Number,
  adjClose: Number
});

marketDataSchema.index({ symbol: 1, date: 1 });
const MarketData = mongoose.model('MarketData', marketDataSchema);

// ── Strategy Schemas ──────────────────────────────────────────────────────────
//
// Single source of truth for every strategy's parameter contract.
// Add new strategy types here — validation picks them up automatically.

const STRATEGY_SCHEMAS = {
  MOVING_AVERAGE_CROSSOVER: {
    params: {
      shortPeriod:     { type: 'integer', required: true,  min: 2,   max: 200      },
      longPeriod:      { type: 'integer', required: true,  min: 5,   max: 500      },
      initialCapital:  { type: 'number',  required: true,  min: 100, max: 1e8      },
      fees:            { type: 'number',  required: false, min: 0,   max: 0.05     }
    },
    minCandles: p => p.longPeriod,
    crossRules: [
      {
        test: p => p.shortPeriod < p.longPeriod,
        field: 'params.shortPeriod',
        message: 'shortPeriod must be strictly less than longPeriod'
      },
      {
        test: p => (p.longPeriod - p.shortPeriod) >= 5,
        field: 'params.longPeriod',
        message: 'longPeriod must be at least 5 greater than shortPeriod to produce meaningful signals'
      }
    ]
  },
  RSI: {
    params: {
      rsiPeriod:       { type: 'integer', required: true,  min: 2,   max: 200      },
      oversold:        { type: 'number',  required: true,  min: 1,   max: 49       },
      overbought:      { type: 'number',  required: true,  min: 51,  max: 99       },
      initialCapital:  { type: 'number',  required: true,  min: 100, max: 1e8      },
      fees:            { type: 'number',  required: false, min: 0,   max: 0.05     }
    },
    minCandles: p => p.rsiPeriod + 1,
    crossRules: [
      {
        test: p => p.oversold < p.overbought,
        field: 'params.oversold',
        message: 'oversold must be strictly less than overbought'
      }
    ]
  },
  MACD: {
    params: {
      initialCapital:  { type: 'number',  required: true,  min: 100, max: 1e8      },
      fees:            { type: 'number',  required: false, min: 0,   max: 0.05     }
    },
    minCandles: () => 35, // 26 (slow EMA) + 9 (signal) for reliable MACD
    crossRules: []
  }
};

const VALID_STRATEGIES = Object.keys(STRATEGY_SCHEMAS);

// ── Validation Helper ─────────────────────────────────────────────────────────
//
// Pure function — no DB calls, no side effects.
// Returns { errors: [...], warnings: [...] }
// errors   → block the request (400)
// warnings → advisory, included in response metadata

function validateBacktest(body) {
  const errors   = [];
  const warnings = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    errors.push({ field: 'body', message: 'Request body must be a JSON object' });
    return { errors, warnings };
  }

  const { symbol, strategyType, params, startDate, endDate } = body;

  // ── symbol ────────────────────────────────────────────────────────────────
  if (!symbol) {
    errors.push({ field: 'symbol', message: 'symbol is required' });
  } else if (typeof symbol !== 'string') {
    errors.push({ field: 'symbol', message: 'symbol must be a string', received: symbol });
  } else if (!/^[A-Z0-9.\-^]{1,20}$/i.test(symbol.trim())) {
    errors.push({
      field: 'symbol',
      message: 'symbol must be 1–20 characters (A-Z, 0-9, . - ^)',
      received: symbol
    });
  }

  // ── strategyType ──────────────────────────────────────────────────────────
  if (!strategyType) {
    errors.push({ field: 'strategyType', message: 'strategyType is required' });
  } else if (!VALID_STRATEGIES.includes(strategyType)) {
    errors.push({
      field: 'strategyType',
      message: `strategyType must be one of: ${VALID_STRATEGIES.join(', ')}`,
      received: strategyType
    });
  }

  // ── dates ─────────────────────────────────────────────────────────────────
  let startDateObj = null;
  let endDateObj   = null;

  if (startDate !== undefined) {
    startDateObj = new Date(startDate);
    if (isNaN(startDateObj.getTime())) {
      errors.push({ field: 'startDate', message: 'startDate is not a valid date', received: startDate });
      startDateObj = null;
    }
  }

  if (endDate !== undefined) {
    endDateObj = new Date(endDate);
    if (isNaN(endDateObj.getTime())) {
      errors.push({ field: 'endDate', message: 'endDate is not a valid date', received: endDate });
      endDateObj = null;
    }
  }

  if (startDateObj && endDateObj) {
    if (startDateObj >= endDateObj) {
      errors.push({ field: 'startDate', message: 'startDate must be before endDate' });
    } else {
      const days = (endDateObj - startDateObj) / 86400000;
      if (days < 365) {
        warnings.push('Backtest period is under 1 year — results may not be statistically reliable');
      }
    }
  }

  // ── params ────────────────────────────────────────────────────────────────
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    errors.push({ field: 'params', message: 'params must be a JSON object' });
    return { errors, warnings };
  }

  // Param-level validation against schema
  if (strategyType && VALID_STRATEGIES.includes(strategyType)) {
    const schema = STRATEGY_SCHEMAS[strategyType];

    for (const [key, rules] of Object.entries(schema.params)) {
      const path  = `params.${key}`;
      const value = params[key];

      if (rules.required && (value === undefined || value === null)) {
        errors.push({ field: path, message: `${key} is required` });
        continue;
      }

      if (value === undefined || value === null) continue; // optional, not provided

      // Type check
      if (rules.type === 'integer') {
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          errors.push({ field: path, message: `${key} must be a whole number (integer)`, received: value });
          continue;
        }
      } else if (rules.type === 'number') {
        if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
          errors.push({ field: path, message: `${key} must be a finite number`, received: value });
          continue;
        }
      }

      // Range checks
      if (rules.min !== undefined && value < rules.min) {
        errors.push({ field: path, message: `${key} must be ≥ ${rules.min}`, received: value });
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push({ field: path, message: `${key} must be ≤ ${rules.max}`, received: value });
      }
    }

    // Cross-param rules — only after all individual params pass
    const hasParamErrors = errors.some(e => e.field && e.field.startsWith('params.'));
    if (!hasParamErrors) {
      for (const rule of schema.crossRules) {
        if (!rule.test(params)) {
          errors.push({ field: rule.field, message: rule.message });
        }
      }
    }

    // Warn about unknown params being silently ignored
    const knownParams = new Set(Object.keys(schema.params));
    const unknown = Object.keys(params).filter(k => !knownParams.has(k));
    if (unknown.length > 0) {
      warnings.push(`Unknown params will be ignored: ${unknown.join(', ')}`);
    }

    // Advisory warnings (non-blocking)
    if (typeof params.initialCapital === 'number' && params.initialCapital < 1000) {
      warnings.push('initialCapital below $1,000 may severely limit position sizing');
    }
    if (typeof params.longPeriod === 'number' && params.longPeriod > 300) {
      warnings.push('longPeriod above 300 tends to generate very few crossover signals');
    }
  }

  return { errors, warnings };
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

/**
 * GET /api/assets
 * Returns all symbols in the database with metadata.
 */
app.get('/api/assets', async (req, res) => {
  try {
    const symbols = await MarketData.distinct('symbol');

    const assets = await Promise.all(symbols.map(async (symbol) => {
      const count = await MarketData.countDocuments({ symbol });
      const first = await MarketData.findOne({ symbol }).sort({ date:  1 });
      const last  = await MarketData.findOne({ symbol }).sort({ date: -1 });

      return {
        symbol,
        recordCount: count,
        startDate:   first ? first.date  : null,
        endDate:     last  ? last.date   : null,
        lastPrice:   last  ? last.close  : null
      };
    }));

    res.json({
      count:  assets.length,
      assets: assets.sort((a, b) => a.symbol.localeCompare(b.symbol))
    });

  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

/**
 * GET /api/data/:symbol
 * Returns historical price data for a symbol.
 *
 * Query params:
 * - limit:     number of records (default: 100)
 * - startDate: YYYY-MM-DD
 * - endDate:   YYYY-MM-DD
 */
app.get('/api/data/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 100, startDate, endDate } = req.query;

    const query = { symbol: symbol.toUpperCase() };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate)   query.date.$lte = new Date(endDate);
    }

    const data = await MarketData
      .find(query)
      .sort({ date: 1 })
      .limit(parseInt(limit, 10))
      .select('-_id -__v');

    if (data.length === 0) {
      return res.status(404).json({
        error:   'NOT_FOUND',
        message: `No historical data for symbol: ${symbol.toUpperCase()}`
      });
    }

    res.json({ symbol: symbol.toUpperCase(), count: data.length, data });

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

/**
 * POST /api/backtest
 * Run a backtest simulation.
 *
 * Request body:
 * {
 *   "symbol":       "AAPL",
 *   "strategyType": "MOVING_AVERAGE_CROSSOVER",
 *   "params": {
 *     "shortPeriod":    50,
 *     "longPeriod":     200,
 *     "initialCapital": 10000,
 *     "fees":           0.001   // optional, default 0.001
 *   },
 *   "startDate": "2021-01-01",  // optional
 *   "endDate":   "2024-01-15"   // optional
 * }
 */
app.post('/api/backtest', async (req, res) => {
  try {
    const startTime = Date.now();

    // ── 1. Structural + range validation (no DB) ─────────────────────────
    const { errors, warnings } = validateBacktest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        error:   'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: errors
      });
    }

    const { symbol, strategyType, params, startDate, endDate } = req.body;
    const ticker = symbol.trim().toUpperCase();

    // ── 2. Ticker existence check ────────────────────────────────────────
    const tickerExists = await MarketData.exists({ symbol: ticker });
    if (!tickerExists) {
      return res.status(404).json({
        error:   'UNKNOWN_TICKER',
        message: `Symbol '${ticker}' not found. Use GET /api/assets to see available tickers.`
      });
    }

    console.log(`\n🔄 Running backtest for ${ticker} (${strategyType})`);
    console.log(`   Period: ${startDate || 'all'} → ${endDate || 'all'}`);

    // ── 3. Fetch historical data ─────────────────────────────────────────
    const query = { symbol: ticker };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate)   query.date.$lte = new Date(endDate);
    }

    const historicalData = await MarketData
      .find(query)
      .sort({ date: 1 })
      .lean();

    if (historicalData.length === 0) {
      return res.status(404).json({
        error:   'NO_DATA',
        message: `No data for '${ticker}' in the specified date range`
      });
    }

    console.log(`   Loaded ${historicalData.length} candles`);

    // ── 4. Data sufficiency check ────────────────────────────────────────
    const schema = STRATEGY_SCHEMAS[strategyType];
    const minCandles = schema.minCandles(params);
    if (historicalData.length < minCandles) {
      return res.status(422).json({
        error:   'INSUFFICIENT_DATA',
        message: `Strategy needs ≥ ${minCandles} candles but date range only has ${historicalData.length}. Widen the date range.`
      });
    }

    // ── 5. Run simulation ────────────────────────────────────────────────
    const engine  = new SimulationEngine(historicalData, params.initialCapital, { strategyType, params });
    const results = await engine.run();

    const executionTime = Date.now() - startTime;
    console.log(`✅ Backtest completed in ${executionTime}ms`);

    results.metadata = {
      executionTimeMs: executionTime,
      dataPoints:      historicalData.length,
      timestamp:       new Date().toISOString(),
      ...(warnings.length > 0 && { warnings })
    };

    res.json(results);

  } catch (error) {
    console.error('❌ Backtest error:', error);
    res.status(500).json({
      error:   'INTERNAL_ERROR',
      message: error.message,
      stack:   process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/validate-strategy
 * Dry-run validation — returns errors + warnings without running the backtest.
 */
app.post('/api/validate-strategy', async (req, res) => {
  try {
    const { errors, warnings } = validateBacktest(req.body);

    // DB ticker check — only if symbol passed structural validation
    const { symbol } = req.body || {};
    const symbolOk = symbol
      && typeof symbol === 'string'
      && symbol.trim().length > 0
      && errors.every(e => e.field !== 'symbol');

    if (symbolOk) {
      const ticker = symbol.trim().toUpperCase();
      const exists = await MarketData.exists({ symbol: ticker });
      if (!exists) {
        errors.push({
          field:   'symbol',
          message: `Symbol '${ticker}' not found. Use GET /api/assets to see available tickers.`
        });
      }
    }

    const valid = errors.length === 0;
    res.json({
      valid,
      errors,
      warnings,
      message: valid ? 'Strategy configuration is valid' : 'Strategy configuration has errors'
    });

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// ── Error Handlers ────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    error:   'NOT_FOUND',
    message: `Route ${req.method} ${req.path} does not exist`
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error:   'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 TradeRetro API Server');
  console.log('='.repeat(60));
  console.log(`📡 http://localhost:${PORT}`);
  console.log(`🗄️  ${process.env.MONGODB_URI || 'mongodb://localhost:27017/traderetro'}`);
  console.log(`🌍 ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60));
  console.log('\nEndpoints:');
  console.log('  GET  /api/health');
  console.log('  GET  /api/assets');
  console.log('  GET  /api/data/:symbol');
  console.log('  POST /api/backtest');
  console.log('  POST /api/validate-strategy');
  console.log('');
});

module.exports = app;
