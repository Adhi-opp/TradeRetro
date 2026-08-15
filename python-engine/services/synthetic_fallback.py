"""
Synthetic Historical Data Generator Fallback
============================================
Generates realistic OHLCV daily price series for backtesting when PostgreSQL DB is offline.
"""

import numpy as np
import pandas as pd
from datetime import date, timedelta


def generate_synthetic_candles(
    ticker: str,
    start_date_obj: date | None = None,
    end_date_obj: date | None = None,
    days: int = 500,
) -> pd.DataFrame:
    end = end_date_obj or date.today()
    target_start = start_date_obj or (end - timedelta(days=days))
    actual_start = target_start - timedelta(days=120)

    date_range = pd.date_range(start=actual_start, end=end, freq="B")
    n = len(date_range)
    if n < 10:
        date_range = pd.date_range(end=end, periods=250, freq="B")
        n = len(date_range)

    # Seed deterministic pseudo-random generator per ticker for consistency
    seed = sum(ord(c) for c in ticker) % 10000
    rng = np.random.default_rng(seed)

    base_price = 2400.0 if "RELIANCE" in ticker else (1800.0 if "INFY" in ticker else 1000.0)
    returns = rng.normal(0.0004, 0.015, n)
    price_path = base_price * np.exp(np.cumsum(returns))

    highs = price_path * (1 + rng.uniform(0.002, 0.012, n))
    lows = price_path * (1 - rng.uniform(0.002, 0.012, n))
    opens = lows + (highs - lows) * rng.uniform(0.2, 0.8, n)
    closes = price_path
    volumes = rng.integers(500000, 5000000, n)

    df = pd.DataFrame({
        "date": date_range,
        "open": opens,
        "high": highs,
        "low": lows,
        "close": closes,
        "volume": volumes,
    })

    df["sma_20"] = df["close"].rolling(20).mean()
    df["sma_50"] = df["close"].rolling(50).mean()
    df["sma_200"] = df["close"].rolling(200).mean()
    df["daily_return_pct"] = df["close"].pct_change() * 100.0

    return df
