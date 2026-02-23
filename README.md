# TradeRetro

**Institutional-grade backtesting engine with an AI Truth Detector that exposes LLM hallucinations in trading strategies.**

TradeRetro lets you backtest classic technical strategies (SMA Crossover, RSI, MACD) against real historical data across US and Indian markets, and separately verify whether AI-generated trading strategies actually deliver what they claim.

---

## Architecture

```
TradeRetro/
├── client/          React 19 + Vite frontend (Progressive Terminal UI)
├── server/          Express 5 + MongoDB backend (Backtest Engine)
└── bs_detector/     FastAPI microservice (AI BS Detector)
```

**Three independent services:**

| Service | Port | Stack | Purpose |
|---------|------|-------|---------|
| Frontend | 5173 | React 19, Vite 7, Recharts | Progressive Terminal UI with split-pane IDE layout |
| Backend | 5000 | Express 5, Mongoose 9, MongoDB | Backtest engine, data ingestion, API layer |
| BS Detector | 8000 | FastAPI, Pandas, NumPy | AI strategy verification & truth scoring |

---

## Features

### Manual Backtesting
- **3 strategies:** Moving Average Crossover (Golden/Death Cross), RSI (Oversold/Overbought), MACD (Histogram Crossover)
- **11 stocks:** 10 NSE (RELIANCE, TCS, HDFCBANK, INFY, ICICIBANK, SBIN, HINDUNILVR, BAJFINANCE, BHARTIARTL, WIPRO) + AAPL
- **Full metrics:** Total Return, Buy & Hold comparison, Max Drawdown, Sharpe Ratio, Win Rate, Net Profit
- **Equity curve:** Interactive Recharts line chart — Strategy vs Buy & Hold benchmark
- **Trade ledger:** Entry/Exit dates, shares, P&L per trade with color-coded returns

### AI Verification (BS Detector)
- Paste any Python entry/exit logic an AI gave you
- Enter the AI's claimed Win Rate and Return %
- The engine runs the strategy against real data and produces a **Truth Score (0-100)**
- Verdicts: **LEGIT** / **EXAGGERATED** / **MISLEADING** / **BS**
- Claims vs Reality comparison table

### Progressive Terminal UI
- **Landing page gatekeeper** — dark, minimal screen with "Launch Terminal" entry
- **Split-pane IDE layout** — Left pane (35%) for controls, Right pane (65%) for results
- **Lock-on-execute** — Control panel locks with overlay during strategy execution
- **Smooth collapse** — Animated slide transition for panel toggle
- **Light/Dark theme** — Toggle with localStorage persistence
- **Clickable logo** — Returns to landing page from anywhere

---

## Quick Start

### Prerequisites
- **Node.js** >= 18
- **MongoDB** running locally on port 27017
- **Python** >= 3.9

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/TradeRetro.git
cd TradeRetro

# Server
cd server
npm install

# Client
cd ../client
npm install

# BS Detector
cd ../bs_detector
pip install -r requirements.txt
```

### 2. Configure Environment

Create `server/.env`:
```
MONGODB_URI=mongodb://localhost:27017/traderetro
PORT=5000
NODE_ENV=development
```

### 3. Ingest Stock Data

```bash
cd server
npm run ingest
```

This batch-ingests all 11 CSV files from `server/data/` into MongoDB. The script auto-detects CSV format (Investing.com for AAPL, yfinance format for NSE stocks).

### 4. Start All Services

```bash
# Terminal 1 — Backend
cd server
npm run dev

# Terminal 2 — BS Detector
cd bs_detector
uvicorn bs_api:app --reload --port 8000

# Terminal 3 — Frontend
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## API Endpoints

### Backend (Port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/backtest` | Run a strategy backtest |
| GET | `/api/data/:symbol` | Get historical data for a symbol |
| GET | `/api/assets` | List all available symbols in DB |
| POST | `/api/verify-ai-strategy` | Proxy to BS Detector microservice |
| GET | `/api/bs-detector/stocks` | List stocks available for AI verification |

### BS Detector (Port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/verify` | Verify AI strategy claims against real data |
| GET | `/health` | Health check + available stock list |

---

## Project Structure

```
client/src/
├── App.jsx                 Landing gate (hasEntered state + theme)
├── index.css               Full design system (dark/light themes)
└── components/
    ├── Landing.jsx          Gatekeeper screen
    ├── Dashboard.jsx        Split-pane IDE shell + all state/API logic
    ├── LeftPane.jsx         Control center (mode toggle, forms, lock overlay)
    ├── RightPane.jsx        Output monitor (idle, loading, results)
    ├── StrategyForm.jsx     Manual backtest form (stock dropdown, params)
    ├── AiVerifyForm.jsx     AI verification form (code input, claims)
    ├── MetricsCard.jsx      Individual metric display card
    ├── EquityChart.jsx      Recharts equity curve (Strategy vs Buy & Hold)
    ├── TradeTable.jsx       Trade ledger table
    └── VerdictCard.jsx      AI verdict display (truth score, comparisons)

server/src/
├── index.js                Express server + routes + MarketData model
├── engine/
│   └── SimulationEngine.js  Strategy execution (SMA, RSI, MACD)
├── routes/
│   └── bsDetector.js        Proxy to Python microservice
├── scripts/
│   ├── ingestData.js         Batch CSV ingestion (auto-format detection)
│   └── fetchAndSave.js       Yahoo Finance live fetcher

bs_detector/
├── bs_api.py                FastAPI endpoints + truth scoring logic
├── data/                    10 NSE stock CSVs (synthetic via GBM)
│   └── fetch_nse_data.py    Data generation script
└── requirements.txt
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Recharts 3, Lucide Icons |
| Backend | Express 5, Mongoose 9, MongoDB |
| AI Engine | FastAPI, Pandas, NumPy |
| Styling | Custom CSS design system (CSS variables, no framework) |
| Fonts | Inter (sans), JetBrains Mono (mono) |

---

## Available Stocks

### NSE (India)
RELIANCE, TCS, HDFCBANK, INFY, ICICIBANK, SBIN, HINDUNILVR, BAJFINANCE, BHARTIARTL, WIPRO



## License

MIT
