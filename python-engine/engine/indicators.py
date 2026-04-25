"""
Technical Indicators — Dynamic Computation
===========================================
SMAs (20/50/200) are pre-computed in PostgreSQL's analytics.daily_signals.
This module only computes indicators NOT in the Gold layer:
- RSI (Wilder's smoothing) — matches npm technicalindicators
- MACD (EMA 12/26/9) — matches npm technicalindicators
"""

import numpy as np
import pandas as pd


def compute_rsi(close_prices: np.ndarray, period: int = 14) -> np.ndarray:
    """
    RSI using Wilder's smoothing (EMA with alpha=1/period).

    Matches the npm 'technicalindicators' RSI output.
    Returns array of length (len(close_prices) - period).
    The first `period` values have no RSI (insufficient data).
    """
    deltas = np.diff(close_prices)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    # Wilder's smoothing: first value is SMA, then EMA with alpha=1/period
    alpha = 1.0 / period

    # First average: simple mean of first `period` values
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    rsi_values = []

    for i in range(period, len(deltas)):
        avg_gain = avg_gain * (1 - alpha) + gains[i] * alpha
        avg_loss = avg_loss * (1 - alpha) + losses[i] * alpha

        if avg_loss == 0:
            rsi_values.append(100.0)
        else:
            rs = avg_gain / avg_loss
            rsi_values.append(100.0 - (100.0 / (1.0 + rs)))

    return np.array(rsi_values)


def compute_macd(close_prices: np.ndarray,
                 fast_period: int = 12,
                 slow_period: int = 26,
                 signal_period: int = 9) -> list[dict]:
    """
    MACD using EMA (exponential moving average).

    Matches npm 'technicalindicators' MACD output.
    Returns list of dicts with keys: MACD, signal, histogram.
    Length = len(close_prices) - (slow_period - 1).
    """
    series = pd.Series(close_prices)

    ema_fast = series.ewm(span=fast_period, adjust=False).mean()
    ema_slow = series.ewm(span=slow_period, adjust=False).mean()

    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal_period, adjust=False).mean()
    histogram = macd_line - signal_line

    # Trim to match npm library output: starts at index (slow_period - 1)
    offset = slow_period - 1
    results = []
    for i in range(offset, len(close_prices)):
        results.append({
            "MACD": float(macd_line.iloc[i]),
            "signal": float(signal_line.iloc[i]),
            "histogram": float(histogram.iloc[i]),
        })

    return results


def compute_sma(close_prices: np.ndarray, period: int) -> np.ndarray:
    """
    Simple Moving Average — fallback for non-standard periods not in PG.

    Returns array of length (len(close_prices) - period + 1).
    """
    series = pd.Series(close_prices)
    sma = series.rolling(window=period).mean().dropna()
    return sma.to_numpy()


def compute_bollinger_bands(close_prices: np.ndarray, period: int = 20, std_dev: float = 2.0) -> list[dict]:
    """
    Bollinger Bands: SMA ± (StdDev * std_dev_factor).

    Returns list of dicts with keys: middle, upper, lower, close_price.
    Length = len(close_prices) - period + 1.
    """
    series = pd.Series(close_prices)
    sma = series.rolling(window=period).mean()
    std = series.rolling(window=period).std()

    upper = sma + (std * std_dev)
    lower = sma - (std * std_dev)

    results = []
    for i in range(period - 1, len(close_prices)):
        results.append({
            "middle": float(sma.iloc[i]) if not pd.isna(sma.iloc[i]) else None,
            "upper": float(upper.iloc[i]) if not pd.isna(upper.iloc[i]) else None,
            "lower": float(lower.iloc[i]) if not pd.isna(lower.iloc[i]) else None,
            "close": float(close_prices[i]),
        })

    return results


def compute_vwap(prices: np.ndarray, volumes: np.ndarray) -> np.ndarray:
    """
    Volume-Weighted Average Price (cumulative).

    VWAP = Σ(price * volume) / Σ(volume)
    
    Returns array of same length as prices.
    """
    if len(prices) != len(volumes):
        raise ValueError("prices and volumes must have same length")

    cumulative_pv = np.cumsum(prices * volumes)
    cumulative_vol = np.cumsum(volumes)
    
    # Avoid division by zero
    vwap = np.where(cumulative_vol > 0, cumulative_pv / cumulative_vol, prices)
    return vwap


def compute_donchian_channel(high_prices: np.ndarray, low_prices: np.ndarray, period: int = 20) -> list[dict]:
    """
    Donchian Channel: highest high and lowest low over N periods.

    Returns list of dicts with keys: highest_high, lowest_low, mid.
    Length = len(high_prices) - period + 1.
    """
    high_series = pd.Series(high_prices)
    low_series = pd.Series(low_prices)

    highest = high_series.rolling(window=period).max()
    lowest = low_series.rolling(window=period).min()

    results = []
    for i in range(period - 1, len(high_prices)):
        hh = float(highest.iloc[i]) if not pd.isna(highest.iloc[i]) else None
        ll = float(lowest.iloc[i]) if not pd.isna(lowest.iloc[i]) else None
        mid = (hh + ll) / 2.0 if (hh is not None and ll is not None) else None

        results.append({
            "highest_high": hh,
            "lowest_low": ll,
            "mid": mid,
        })

    return results
