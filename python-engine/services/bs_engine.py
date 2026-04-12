"""
BS Detector — Backtest Engine & Verdict Generator
==================================================
Runs user strategies against real data and scores AI claims.
"""

import math
from typing import Optional

import numpy as np
import pandas as pd

from services.bs_sandbox import SafeCandle


class AIClaims:
    def __init__(self, win_rate=None, total_return=None, max_drawdown=None, description=None):
        self.win_rate = win_rate
        self.total_return = total_return
        self.max_drawdown = max_drawdown
        self.description = description


def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add common technical indicators to a price DataFrame."""
    c = df["close"]

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

        if row.isna().any():
            equity_curve.append(cash + shares * row["close"] if not math.isnan(row["close"]) else cash)
            continue

        portfolio_value = cash + shares * row["close"]
        equity_curve.append(portfolio_value)
        candle = SafeCandle(row)

        try:
            if shares == 0:
                if entry_fn(candle, entry_price=None):
                    entry_price = float(row["close"])
                    shares = int(cash * 0.95 / entry_price)
                    cash -= shares * entry_price
            else:
                if exit_fn(candle, entry_price=entry_price):
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

    winning = [t for t in trades if t["is_win"]]

    eq = np.array(equity_curve) if equity_curve else np.array([initial_capital])
    peak = np.maximum.accumulate(eq)
    drawdown = (eq - peak) / np.where(peak == 0, 1, peak)
    max_dd = float(drawdown.min()) * 100

    return {
        "total_return": round(float(total_return), 2),
        "win_rate": round(float(len(winning) / len(trades) * 100) if trades else 0, 2),
        "max_drawdown": round(float(max_dd), 2),
        "total_trades": int(len(trades)),
        "winning_trades": int(len(winning)),
        "losing_trades": int(len(trades) - len(winning)),
        "final_value": round(float(final_value), 2),
        "initial_capital": float(initial_capital),
        "trades": trades[-20:],
    }


def generate_verdict(actual: dict, claims: Optional[AIClaims]) -> dict:
    """Compare actual backtest results against AI claims. Returns truth score (0-100) and verdict."""
    if not claims or (claims.win_rate is None and claims.total_return is None):
        return {
            "truth_score_pct": None,
            "label": "NO_CLAIMS",
            "detail": "No AI claims provided \u2014 showing raw backtest results only.",
            "comparisons": [],
        }

    comparisons = []
    penalties = []

    if claims.win_rate is not None:
        gap = claims.win_rate - actual["win_rate"]
        comparisons.append({
            "metric": "Win Rate", "claimed": claims.win_rate,
            "actual": actual["win_rate"], "gap": round(gap, 2), "unit": "%",
        })
        if gap > 0:
            penalties.append(min(gap * 2, 50))

    if claims.total_return is not None:
        gap = claims.total_return - actual["total_return"]
        comparisons.append({
            "metric": "Total Return", "claimed": claims.total_return,
            "actual": actual["total_return"], "gap": round(gap, 2), "unit": "%",
        })
        if gap > 0:
            penalties.append(min(gap * 1.5, 50))

    if claims.max_drawdown is not None:
        claimed_dd = abs(claims.max_drawdown)
        actual_dd = abs(actual["max_drawdown"])
        gap = actual_dd - claimed_dd
        comparisons.append({
            "metric": "Max Drawdown", "claimed": claims.max_drawdown,
            "actual": actual["max_drawdown"], "gap": round(gap, 2), "unit": "%",
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

    details = {
        "LEGIT": "The AI's claims are broadly consistent with backtested results. The strategy appears honest.",
        "EXAGGERATED": "The AI overstated performance by a noticeable margin. Results are real but inflated.",
        "MISLEADING": "Significant gap between claims and reality. The AI's numbers are not trustworthy.",
        "BS": "The AI's claims bear little resemblance to actual backtest results. Pure hallucination.",
    }

    return {
        "truth_score_pct": truth_score,
        "label": label,
        "detail": details.get(label, ""),
        "comparisons": comparisons,
    }
