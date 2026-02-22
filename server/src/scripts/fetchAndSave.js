// server/src/scripts/fetchAndSave.js
const mongoose = require('mongoose');
const yahooFinance = require('yahoo-finance2').default; // Stable import for v2.4.3
require('dotenv').config();

const marketDataSchema = new mongoose.Schema({
  symbol: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  open: Number,
  high: Number,
  low: Number,
  close: Number,
  volume: Number,
  adjClose: Number
});
marketDataSchema.index({ symbol: 1, date: 1 }, { unique: true });
const MarketData = mongoose.model('MarketData', marketDataSchema);

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/traderetro');
  console.log('✅ Connected to MongoDB');
}

async function fetchAndSave(symbol) {
  try {
    console.log(`📥 Fetching DAILY data for ${symbol} from Yahoo Finance...`);
    
    // Simple fetch - works with v2.4.3
    const queryOptions = { period1: '2010-01-01', interval: '1d' };
    const result = await yahooFinance.historical(symbol, queryOptions);

    if (!result || result.length === 0) throw new Error('No data returned');

    console.log(`📊 Received ${result.length} candles. Processing...`);

    const documents = result.map(quote => ({
      symbol: symbol.toUpperCase(),
      date: quote.date,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.close,
      volume: quote.volume,
      adjClose: quote.adjClose || quote.close
    }));

    await MarketData.deleteMany({ symbol: symbol.toUpperCase() });
    await MarketData.insertMany(documents);
    
    console.log(`💾 Successfully saved ${documents.length} candles for ${symbol}`);
    
  } catch (error) {
    console.error(`❌ Error fetching ${symbol}:`, error.message);
  }
}

(async () => {
  await connectDB();
  await fetchAndSave('AAPL'); 
  process.exit(0);
})();