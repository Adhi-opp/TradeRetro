"""
Generate realistic stock data for BS Detector backtesting.
Creates 5 years of daily OHLCV data for NSE stocks using
geometric Brownian motion with stock-specific parameters.

This avoids dependency on Yahoo Finance API which is unreliable.
"""

import os
import numpy as np
import pandas as pd

DATA_DIR = os.path.dirname(os.path.abspath(__file__))

# Stock configs: (symbol, starting_price, annual_return, annual_volatility)
STOCKS = [
    ("RELIANCE",    2500,  0.15, 0.28),
    ("TCS",         3400,  0.12, 0.22),
    ("HDFCBANK",    1600,  0.10, 0.25),
    ("INFY",        1500,  0.14, 0.26),
    ("ICICIBANK",   900,   0.18, 0.30),
    ("HINDUNILVR",  2400,  0.08, 0.20),
    ("SBIN",        550,   0.20, 0.35),
    ("BAJFINANCE",  6800,  0.22, 0.38),
    ("BHARTIARTL",  800,   0.16, 0.27),
    ("WIPRO",       450,   0.06, 0.24),
]


def generate_stock(symbol, start_price, annual_return, annual_vol, years=5, seed=None):
    """Generate realistic daily OHLCV data using geometric Brownian motion."""
    if seed is not None:
        np.random.seed(seed)

    trading_days = int(252 * years)
    dt = 1 / 252
    drift = (annual_return - 0.5 * annual_vol ** 2) * dt
    diffusion = annual_vol * np.sqrt(dt)

    # Generate log returns
    log_returns = np.random.normal(drift, diffusion, trading_days)

    # Build close prices
    close = np.zeros(trading_days)
    close[0] = start_price
    for i in range(1, trading_days):
        close[i] = close[i - 1] * np.exp(log_returns[i])

    # Generate OHLV from close
    daily_range = annual_vol * np.sqrt(dt) * close
    high = close + np.abs(np.random.normal(0, 1, trading_days)) * daily_range * 0.6
    low = close - np.abs(np.random.normal(0, 1, trading_days)) * daily_range * 0.6
    open_price = low + np.random.uniform(0.2, 0.8, trading_days) * (high - low)

    # Ensure OHLC consistency
    high = np.maximum(high, np.maximum(open_price, close))
    low = np.minimum(low, np.minimum(open_price, close))

    # Volume: base volume with some randomness and trend correlation
    base_volume = np.random.lognormal(mean=15, sigma=0.5, size=trading_days)
    vol_spike = 1 + 2 * np.abs(log_returns)  # Higher volume on big moves
    volume = (base_volume * vol_spike).astype(int)

    # Generate business day dates (skip weekends)
    end_date = pd.Timestamp("2025-02-20")
    dates = pd.bdate_range(end=end_date, periods=trading_days)

    df = pd.DataFrame({
        "date": dates,
        "open": np.round(open_price, 2),
        "high": np.round(high, 2),
        "low": np.round(low, 2),
        "close": np.round(close, 2),
        "volume": volume,
    })
    df.set_index("date", inplace=True)

    out_path = os.path.join(DATA_DIR, f"{symbol}.csv")
    df.to_csv(out_path)
    print(f"  {symbol}: {len(df)} rows, ${close[0]:.0f} -> ${close[-1]:.0f} | Saved -> {out_path}")
    return True


def main():
    print("=" * 50)
    print("NSE Data Generator for BS Detector")
    print("=" * 50)
    print()

    for i, (symbol, price, ret, vol) in enumerate(STOCKS):
        generate_stock(symbol, price, ret, vol, seed=42 + i)

    print(f"\nDone: {len(STOCKS)} stocks generated.")


if __name__ == "__main__":
    main()
