"""
BS Detector — Python Judge Microservice
========================================
Receives an AI-claimed trading strategy (entry/exit conditions as Python),
backtests it against real NSE data, and returns a Truth Score comparing
actual performance vs claimed performance.

Run:  uvicorn bs_api:app --reload --port 8000
"""

import os
import math
import traceback
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="BS Detector", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

# Columns available to user-defined strategy code
ALLOWED_COLUMNS = {
    "open", "high", "low", "close", "volume",
    "sma_20", "sma_50", "sma_200",
    "rsi_14", "macd", "macd_signal",
    "upper_bb", "lower_bb",
}


# ── Request / Response Models ─────────────────────────────────────────────────

class AIClaims(BaseModel):
    win_rate: Optional[float] = None
    total_return: Optional[float] = None
    max_drawdown: Optional[float] = None
    description: Optional[str] = None


class VerifyRequest(BaseModel):
    stock: str
    entry_body: str
    exit_body: str
    ai_claims: Optional[AIClaims] = None


# ── Technical Indicator Helpers ───────────────────────────────────────────────

def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add common technical indicators to a price DataFrame."""
    c = df["close"]

    # SMAs
    df["sma_20"] = c.rolling(20).mean()
    df["sma_50"] = c.rolling(50).mean()
    df["sma_200"] = c.rolling(200).mean()

    # RSI (14)
    delta = c.diff()
    gain = delta.where(delta > 0, 0.0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    df["rsi_14"] = 100 - (100 / (1 + rs))

    # MACD (12, 26, 9)
    ema12 = c.ewm(span=12, adjust=False).mean()
    ema26 = c.ewm(span=26, adjust=False).mean()
    df["macd"] = ema12 - ema26
    df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()

    # Bollinger Bands (20, 2)
    sma20 = df["sma_20"]
    std20 = c.rolling(20).std()
    df["upper_bb"] = sma20 + 2 * std20
    df["lower_bb"] = sma20 - 2 * std20

    return df


# ── Safe Strategy Execution ──────────────────────────────────────────────────

def _build_safe_function(body: str, name: str):
    """
    Compile a user-provided Python function body into a callable.
    The function receives a `candle` (pd.Series row) and optionally `entry_price`.
    Restricted to a safe namespace — no imports, no file access.
    """
    code = f"def {name}(candle, entry_price=None):\n"
    for line in body.strip().splitlines():
        code += f"    {line}\n"

    safe_globals = {"__builtins__": {"abs": abs, "max": max, "min": min, "round": round, "True": True, "False": False}}
    safe_locals = {}

    try:
        exec(compile(code, f"<{name}>", "exec"), safe_globals, safe_locals)
    except SyntaxError as e:
        raise HTTPException(status_code=400, detail=f"Syntax error in {name}: {e}")

    return safe_locals[name]


# ── Backtesting Engine ───────────────────────────────────────────────────────

def backtest(df: pd.DataFrame, entry_fn, exit_fn) -> dict:
    """
    Run a simple long-only backtest over the DataFrame.
    Returns metrics dict with total_return, win_rate, max_drawdown, trade count, etc.
    """
    initial_capital = 100000.0
    cash = initial_capital
    shares = 0
    entry_price = 0.0
    trades = []
    equity_curve = []

    for i in range(len(df)):
        row = df.iloc[i]

        # Skip rows with NaN indicators
        if row.isna().any():
            equity_curve.append(cash + shares * row["close"] if not math.isnan(row["close"]) else cash)
            continue

        portfolio_value = cash + shares * row["close"]
        equity_curve.append(portfolio_value)

        try:
            if shares == 0:
                if entry_fn(row, entry_price=None):
                    entry_price = float(row["close"])
                    shares = int(cash * 0.95 / entry_price)
                    cash -= shares * entry_price
            else:
                if exit_fn(row, entry_price=entry_price):
                    exit_price = float(row["close"])
                    pnl_pct = ((exit_price - entry_price) / entry_price) * 100
                    cash += shares * exit_price
                    trades.append({
                        "entry_price": round(float(entry_price), 2),
                        "exit_price": round(float(exit_price), 2),
                        "pnl_pct": round(float(pnl_pct), 2),
                        "is_win": bool(pnl_pct > 0),
                    })
                    shares = 0
                    entry_price = 0.0
        except Exception:
            continue

    # Force close open position
    if shares > 0 and len(df) > 0:
        exit_price = float(df.iloc[-1]["close"])
        pnl_pct = ((exit_price - entry_price) / entry_price) * 100
        cash += shares * exit_price
        trades.append({
            "entry_price": round(float(entry_price), 2),
            "exit_price": round(float(exit_price), 2),
            "pnl_pct": round(float(pnl_pct), 2),
            "is_win": bool(pnl_pct > 0),
        })
        shares = 0

    final_value = float(cash)
    total_return = ((final_value - initial_capital) / initial_capital) * 100

    # Win rate
    winning = [t for t in trades if t["is_win"]]
    win_rate = (len(winning) / len(trades) * 100) if trades else 0

    # Max drawdown
    eq = np.array(equity_curve) if equity_curve else np.array([initial_capital])
    peak = np.maximum.accumulate(eq)
    drawdown = (eq - peak) / np.where(peak == 0, 1, peak)
    max_dd = float(drawdown.min()) * 100

    return {
        "total_return": round(float(total_return), 2),
        "win_rate": round(float(win_rate), 2),
        "max_drawdown": round(float(max_dd), 2),
        "total_trades": int(len(trades)),
        "winning_trades": int(len(winning)),
        "losing_trades": int(len(trades) - len(winning)),
        "final_value": round(float(final_value), 2),
        "initial_capital": float(initial_capital),
        "trades": trades[-20:],
    }


# ── Verdict Generator ────────────────────────────────────────────────────────

def generate_verdict(actual: dict, claims: Optional[AIClaims]) -> dict:
    """
    Compare actual backtest results against AI claims.
    Returns a truth score (0-100) and verdict label.
    """
    if not claims or (claims.win_rate is None and claims.total_return is None):
        return {
            "truth_score_pct": None,
            "label": "NO_CLAIMS",
            "detail": "No AI claims provided — showing raw backtest results only.",
            "comparisons": [],
        }

    comparisons = []
    penalties = []

    if claims.win_rate is not None:
        gap = claims.win_rate - actual["win_rate"]
        comparisons.append({
            "metric": "Win Rate",
            "claimed": claims.win_rate,
            "actual": actual["win_rate"],
            "gap": round(gap, 2),
            "unit": "%",
        })
        # Penalty: each 1% overstatement = ~2 point penalty
        if gap > 0:
            penalties.append(min(gap * 2, 50))

    if claims.total_return is not None:
        gap = claims.total_return - actual["total_return"]
        comparisons.append({
            "metric": "Total Return",
            "claimed": claims.total_return,
            "actual": actual["total_return"],
            "gap": round(gap, 2),
            "unit": "%",
        })
        if gap > 0:
            penalties.append(min(gap * 1.5, 50))

    if claims.max_drawdown is not None:
        # Drawdown is negative; claimed is usually less severe
        claimed_dd = abs(claims.max_drawdown)
        actual_dd = abs(actual["max_drawdown"])
        gap = actual_dd - claimed_dd
        comparisons.append({
            "metric": "Max Drawdown",
            "claimed": claims.max_drawdown,
            "actual": actual["max_drawdown"],
            "gap": round(gap, 2),
            "unit": "%",
        })
        if gap > 0:
            penalties.append(min(gap * 2, 30))

    total_penalty = sum(penalties)
    truth_score = max(0, round(100 - total_penalty))

    if truth_score >= 80:
        label = "LEGIT"
    elif truth_score >= 50:
        label = "EXAGGERATED"
    elif truth_score >= 20:
        label = "MISLEADING"
    else:
        label = "BS"

    return {
        "truth_score_pct": truth_score,
        "label": label,
        "detail": _verdict_detail(label),
        "comparisons": comparisons,
    }


def _verdict_detail(label: str) -> str:
    details = {
        "LEGIT": "The AI's claims are broadly consistent with backtested results. The strategy appears honest.",
        "EXAGGERATED": "The AI overstated performance by a noticeable margin. Results are real but inflated.",
        "MISLEADING": "Significant gap between claims and reality. The AI's numbers are not trustworthy.",
        "BS": "The AI's claims bear little resemblance to actual backtest results. Pure hallucination.",
    }
    return details.get(label, "")


# ── API Routes ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    csvs = [f for f in os.listdir(DATA_DIR) if f.endswith(".csv")]
    return {
        "status": "healthy",
        "stocks_available": len(csvs),
        "stocks": [f.replace(".csv", "") for f in sorted(csvs)],
    }


@app.post("/verify")
def verify(req: VerifyRequest):
    stock = req.stock.upper()
    csv_path = os.path.join(DATA_DIR, f"{stock}.csv")

    if not os.path.exists(csv_path):
        available = [f.replace(".csv", "") for f in os.listdir(DATA_DIR) if f.endswith(".csv")]
        raise HTTPException(
            status_code=404,
            detail=f"No data for '{stock}'. Available: {available}. Run fetch_nse_data.py first.",
        )

    # Load and prepare data
    df = pd.read_csv(csv_path, parse_dates=["date"], index_col="date")
    df.columns = [c.lower().strip() for c in df.columns]

    # Ensure required columns exist
    for col in ["open", "high", "low", "close", "volume"]:
        if col not in df.columns:
            raise HTTPException(status_code=500, detail=f"Missing column '{col}' in {stock}.csv")

    df = df.sort_index()
    df = add_indicators(df)

    # Build safe functions from user code
    entry_fn = _build_safe_function(req.entry_body, "entry_condition")
    exit_fn = _build_safe_function(req.exit_body, "exit_condition")

    # Run backtest
    try:
        actual = backtest(df, entry_fn, exit_fn)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Backtest execution error: {e}\n{traceback.format_exc()}")

    # Generate verdict
    verdict = generate_verdict(actual, req.ai_claims)

    return {
        "stock": stock,
        "actual_results": actual,
        "verdict": verdict,
        "data_range": {
            "start": str(df.index.min().date()) if len(df) > 0 else None,
            "end": str(df.index.max().date()) if len(df) > 0 else None,
            "total_candles": len(df),
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
