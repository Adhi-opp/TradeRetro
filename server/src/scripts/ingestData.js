// server/src/scripts/ingestData.js
// Batch ingestion — auto-detects Investing.com vs yfinance CSV formats
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
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

// "10.5M" -> 10500000, "34.38K" -> 34380
function parseVolume(volStr) {
  if (!volStr || volStr === '-') return 0;
  const clean = volStr.toString().replace(/[KMB,]/g, '');
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  if (volStr.includes('B')) return num * 1_000_000_000;
  if (volStr.includes('M')) return num * 1_000_000;
  if (volStr.includes('K')) return num * 1_000;
  return num;
}

// "1,200.50" -> 1200.50
function parsePrice(str) {
  if (!str) return 0;
  return parseFloat(str.toString().replace(/,/g, ''));
}

// Detect format by peeking at the first line
function detectFormat(filePath) {
  const head = fs.readFileSync(filePath, 'utf-8').split('\n')[0];
  if (head.includes('Price') && head.includes('Vol')) return 'investing';
  return 'yfinance';
}

// Parse a single CSV — format-aware
function ingestCSV(filePath, symbol) {
  const format = detectFormat(filePath);
  console.log(`\n📄 ${symbol} — format: ${format}`);

  const results = [];
  const streamOpts = format === 'investing'
    ? { headers: ['Date', 'Price', 'Open', 'High', 'Low', 'Vol', 'Change'], skipLines: 1 }
    : {};

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv(streamOpts))
      .on('data', (row) => {
        let date, open, high, low, close, volume;

        if (format === 'investing') {
          if (!row.Date) return;
          date = new Date(row.Date);
          open = parsePrice(row.Open);
          high = parsePrice(row.High);
          low = parsePrice(row.Low);
          close = parsePrice(row.Price);
          volume = parseVolume(row.Vol);
        } else {
          if (!row.date) return;
          date = new Date(row.date);
          open = parseFloat(row.open) || 0;
          high = parseFloat(row.high) || 0;
          low = parseFloat(row.low) || 0;
          close = parseFloat(row.close) || 0;
          volume = parseFloat(row.volume) || 0;
        }

        if (isNaN(date.getTime())) return;

        results.push({
          symbol,
          date,
          open,
          high,
          low,
          close,
          adjClose: close,
          volume
        });
      })
      .on('end', async () => {
        if (results.length === 0) {
          console.log(`⚠️  No valid rows in ${symbol} — skipping`);
          resolve();
          return;
        }

        results.sort((a, b) => a.date - b.date);

        try {
          await MarketData.deleteMany({ symbol });
          await MarketData.insertMany(results);
          console.log(`✅ ${symbol}: ${results.length} candles ingested`);
        } catch (err) {
          console.error(`❌ ${symbol}: ${err.message}`);
        }
        resolve();
      })
      .on('error', (err) => {
        console.error(`❌ ${symbol}: stream error — ${err.message}`);
        resolve();
      });
  });
}

(async () => {
  try {
    await connectDB();

    const dataDir = path.join(__dirname, '../../data');
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv'));
    console.log(`\n📂 Found ${files.length} CSV files in ${dataDir}\n`);

    for (const file of files) {
      const symbol = path.basename(file, '.csv').toUpperCase();
      await ingestCSV(path.join(dataDir, file), symbol);
    }

    console.log('\n🎉 All ingestion complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Ingestion failed:', err.message);
    process.exit(1);
  }
})();
