/**
 * BS Detector Route
 * =================
 * Adds ONE new endpoint to your existing TradeRetro Express server.
 * Drop this file into: server/src/routes/bsDetector.js
 *
 * Then in your server/src/index.js add:
 *   const bsDetectorRoute = require('./routes/bsDetector');
 *   app.use('/api', bsDetectorRoute);
 *
 * That's it. Your existing code is untouched.
 */

const express = require('express');
const router  = express.Router();

const BS_DETECTOR_URL = process.env.BS_DETECTOR_URL || 'http://localhost:8000';

// ─────────────────────────────────────────────
// POST /api/verify-ai-strategy
// ─────────────────────────────────────────────

/**
 * Main BS Detector endpoint.
 *
 * Accepts an AI-generated strategy description + code,
 * forwards to the Python Judge microservice,
 * and returns the Truth Score verdict.
 *
 * Body:
 * {
 *   "stock": "RELIANCE",
 *   "entry_body": "return candle.rsi_14 < 35 and candle.macd > candle.macd_signal",
 *   "exit_body": "p = (candle.close - entry_price) / entry_price\nreturn p > 0.08 or p < -0.04",
 *   "ai_claims": {
 *     "win_rate": 80,
 *     "total_return": 40,
 *     "max_drawdown": -5,
 *     "description": "GPT said this strategy yields 40% returns with 80% win rate"
 *   }
 * }
 */
router.post('/verify-ai-strategy', async (req, res) => {
  const { stock, entry_body, exit_body, ai_claims } = req.body;

  // ── Validation ───────────────────────────
  if (!stock) {
    return res.status(400).json({ error: 'Missing field: stock (e.g. "RELIANCE")' });
  }
  if (!entry_body || !exit_body) {
    return res.status(400).json({
      error: 'Missing strategy code',
      hint:  'Provide entry_body and exit_body as Python function bodies'
    });
  }

  // ── Forward to Python Judge ───────────────
  console.log(`\n🔍 BS Detector: Verifying ${stock} strategy...`);

  const startMs = Date.now();

  let judgeResponse;
  try {
    const response = await fetch(`${BS_DETECTOR_URL}/verify`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ stock, entry_body, exit_body, ai_claims }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error:   'Judge engine rejected the strategy',
        detail:  err.detail || 'Unknown error',
        hint:    'Check that entry_body and exit_body are valid Python using only allowed columns'
      });
    }

    judgeResponse = await response.json();

  } catch (networkErr) {
    // Python microservice is not running
    if (networkErr.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'BS Detector service unavailable',
        hint:  'Start the Python judge: uvicorn bs_api:app --port 8000'
      });
    }
    throw networkErr;
  }

  const ms = Date.now() - startMs;
  const verdict = judgeResponse.verdict;

  console.log(`⚖️  Verdict: ${verdict.label} | Truth Score: ${verdict.truth_score_pct}% | ${ms}ms`);

  // ── Return enriched response ──────────────
  return res.json({
    ...judgeResponse,
    metadata: {
      execution_ms: ms,
      judge_url:    BS_DETECTOR_URL,
      timestamp:    new Date().toISOString()
    }
  });
});

// ─────────────────────────────────────────────
// GET /api/bs-detector/stocks
// Lists which NSE stocks have data available
// ─────────────────────────────────────────────

router.get('/bs-detector/stocks', async (req, res) => {
  try {
    const response = await fetch(`${BS_DETECTOR_URL}/health`);
    if (!response.ok) throw new Error('Service down');

    return res.json({
      available_stocks: [
        'HDFCBANK', 'ICICIBANK', 'SBIN', 'AXISBANK',
        'TCS', 'INFY', 'WIPRO', 'HCLTECH',
        'RELIANCE', 'ONGC',
        'HINDUNILVR', 'ITC',
        'BAJFINANCE', 'BHARTIARTL',
        'NIFTY50', 'BANKNIFTY'
      ],
      note: 'Run fetch_nse_data.py to refresh data'
    });
  } catch {
    return res.status(503).json({
      error: 'BS Detector service unavailable',
      hint:  'Start with: uvicorn bs_api:app --port 8000'
    });
  }
});

module.exports = router;