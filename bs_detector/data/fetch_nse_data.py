"""
NSE/BSE Synthetic Data Generator — Regime-Switching Model
==========================================================
Generates realistic daily OHLCV data for Indian stocks using a
3-state Markov regime-switching model with GARCH-lite volatility
clustering. Far more realistic than plain GBM.

Regimes:
  - BULL:     μ = +18%, σ = 22%  (scaled per stock)
  - BEAR:     μ = -25%, σ = 40%  (scaled per stock)
  - SIDEWAYS: μ = +2%,  σ = 15%  (scaled per stock)

Regime transitions happen randomly every 3-9 months via a
transition probability matrix (Markov chain).

Volatility clustering: After large moves (>2σ), volatility spikes
for 5-20 days, mimicking real market shock clusters.

Run:  python fetch_nse_data.py
"""

import os
import sys
import numpy as np
import pandas as pd

DATA_DIR = os.path.dirname(os.path.abspath(__file__))

# Also generate into server/data/ if it exists
SERVER_DATA_DIR = os.path.normpath(os.path.join(DATA_DIR, "..", "..", "server", "data"))

# ── Stock Configurations ──────────────────────────────────────────────────────
# (symbol, starting_price, return_scale, vol_scale)
# return_scale and vol_scale multiply the regime base parameters
# to give each stock its own character

STOCKS = [
    # Banking
    ("HDFCBANK",    1600,  0.85, 0.90),
    ("ICICIBANK",   900,   1.10, 1.05),
    ("SBIN",        550,   1.25, 1.30),
    ("AXISBANK",    720,   1.00, 1.10),
    # IT
    ("TCS",         3400,  0.80, 0.78),
    ("INFY",        1500,  0.90, 0.92),
    ("WIPRO",       450,   0.50, 0.95),
    ("HCLTECH",     1100,  0.85, 0.85),
    # Energy
    ("RELIANCE",    2500,  1.00, 1.00),
    ("ONGC",        160,   0.70, 1.15),
    # FMCG
    ("HINDUNILVR",  2400,  0.60, 0.72),
    ("ITC",         220,   0.55, 0.80),
    # Finance
    ("BAJFINANCE",  6800,  1.30, 1.35),
    # Telecom
    ("BHARTIARTL",  800,   1.00, 0.95),
    # Index (synthetic)
    ("NIFTY50",     17500, 0.75, 0.65),
    ("BANKNIFTY",   40000, 0.85, 0.80),
]


# ── Regime Definitions ────────────────────────────────────────────────────────

REGIMES = {
    "BULL":     {"mu": 0.18,  "sigma": 0.22},
    "BEAR":     {"mu": -0.25, "sigma": 0.40},
    "SIDEWAYS": {"mu": 0.02,  "sigma": 0.15},
}

# Markov transition matrix (from_state -> to_state probabilities)
# Rows: [BULL, BEAR, SIDEWAYS], Columns: [BULL, BEAR, SIDEWAYS]
# These are daily transition probabilities calibrated so regimes
# last roughly 3-9 months (60-180 trading days)
TRANSITION_MATRIX = np.array([
    #  BULL   BEAR   SIDE
    [0.990, 0.004, 0.006],  # From BULL
    [0.005, 0.988, 0.007],  # From BEAR
    [0.008, 0.005, 0.987],  # From SIDEWAYS
])

REGIME_NAMES = ["BULL", "BEAR", "SIDEWAYS"]


def generate_regime_sequence(n_days, rng, initial_regime=0):
    """Generate a sequence of market regimes using Markov chain."""
    regimes = np.zeros(n_days, dtype=int)
    regimes[0] = initial_regime

    for i in range(1, n_days):
        current = regimes[i - 1]
        regimes[i] = rng.choice(3, p=TRANSITION_MATRIX[current])

    return regimes


def apply_volatility_clustering(log_returns, sigma_base, rng):
    """
    GARCH-lite: spike volatility for 5-20 days after large moves.
    If |return| > 2*sigma, multiply sigma by 1.5-2.5x for a random duration.
    """
    n = len(log_returns)
    vol_multiplier = np.ones(n)
    i = 0

    while i < n:
        if abs(log_returns[i]) > 2 * sigma_base:
            # Shock detected — spike volatility
            spike_duration = rng.integers(5, 21)
            spike_magnitude = rng.uniform(1.5, 2.5)
            end = min(i + spike_duration, n)
            vol_multiplier[i:end] = spike_magnitude
            i = end
        else:
            i += 1

    return vol_multiplier


def generate_stock(symbol, start_price, return_scale, vol_scale,
                   years=5, seed=None):
    """
    Generate realistic daily OHLCV data using regime-switching model
    with volatility clustering.
    """
    rng = np.random.default_rng(seed)
    trading_days = int(252 * years)
    dt = 1 / 252

    # Step 1: Generate regime sequence
    initial_regime = rng.choice(3, p=[0.5, 0.15, 0.35])
    regimes = generate_regime_sequence(trading_days, rng, initial_regime)

    # Step 2: Generate base log returns per regime
    log_returns = np.zeros(trading_days)
    for i in range(trading_days):
        regime = REGIMES[REGIME_NAMES[regimes[i]]]
        mu = regime["mu"] * return_scale
        sigma = regime["sigma"] * vol_scale
        drift = (mu - 0.5 * sigma ** 2) * dt
        diffusion = sigma * np.sqrt(dt)
        log_returns[i] = rng.normal(drift, diffusion)

    # Step 3: Apply volatility clustering
    base_sigma = 0.25 * vol_scale * np.sqrt(dt)  # rough average sigma
    vol_mult = apply_volatility_clustering(log_returns, base_sigma, rng)

    # Re-scale returns where vol is spiked (keep drift, amplify noise)
    for i in range(trading_days):
        if vol_mult[i] > 1.0:
            regime = REGIMES[REGIME_NAMES[regimes[i]]]
            sigma = regime["sigma"] * vol_scale
            drift = (regime["mu"] * return_scale - 0.5 * sigma ** 2) * dt
            diffusion = sigma * np.sqrt(dt) * vol_mult[i]
            log_returns[i] = rng.normal(drift, diffusion)

    # Step 4: Build close prices
    close = np.zeros(trading_days)
    close[0] = start_price
    for i in range(1, trading_days):
        close[i] = close[i - 1] * np.exp(log_returns[i])
        # Floor price at 1 (prevent negative/zero)
        close[i] = max(close[i], 1.0)

    # Step 5: Generate OHLV from close
    daily_range = np.abs(log_returns) * close + 0.001 * close
    high = close + rng.exponential(0.5, trading_days) * daily_range * 0.6
    low = close - rng.exponential(0.5, trading_days) * daily_range * 0.6
    open_price = low + rng.uniform(0.2, 0.8, trading_days) * (high - low)

    # Ensure OHLC consistency
    high = np.maximum(high, np.maximum(open_price, close))
    low = np.minimum(low, np.minimum(open_price, close))
    low = np.maximum(low, 0.5)  # Floor

    # Step 6: Volume — base + trend correlation + regime sensitivity
    base_volume = rng.lognormal(mean=15, sigma=0.5, size=trading_days)
    vol_spike = 1 + 3 * np.abs(log_returns)  # Higher volume on big moves
    # Bear markets have higher volume (panic selling)
    regime_vol = np.where(regimes == 1, 1.4, np.where(regimes == 0, 1.1, 1.0))
    volume = (base_volume * vol_spike * regime_vol).astype(int)

    # Step 7: Generate business day dates
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

    # Count regime days
    bull_days = np.sum(regimes == 0)
    bear_days = np.sum(regimes == 1)
    side_days = np.sum(regimes == 2)

    return df, {
        "start_price": close[0],
        "end_price": close[-1],
        "bull_days": int(bull_days),
        "bear_days": int(bear_days),
        "sideways_days": int(side_days),
        "total_days": trading_days,
    }


def main():
    print("=" * 60)
    print("NSE/BSE Regime-Switching Data Generator")
    print("=" * 60)
    print(f"Model: 3-state Markov regime switching + GARCH-lite clustering")
    print(f"Stocks: {len(STOCKS)}")
    print(f"Output: {DATA_DIR}")
    if os.path.isdir(SERVER_DATA_DIR):
        print(f"Mirror: {SERVER_DATA_DIR}")
    print()

    for i, (symbol, price, ret_s, vol_s) in enumerate(STOCKS):
        df, meta = generate_stock(symbol, price, ret_s, vol_s, seed=42 + i)

        # Save to bs_detector/data/
        out_path = os.path.join(DATA_DIR, f"{symbol}.csv")
        df.to_csv(out_path)

        # Also save to server/data/ if directory exists
        if os.path.isdir(SERVER_DATA_DIR):
            server_path = os.path.join(SERVER_DATA_DIR, f"{symbol}.csv")
            df.to_csv(server_path)

        print(
            f"  {symbol:12s}: {meta['total_days']} rows | "
            f"Rs.{meta['start_price']:,.0f} -> Rs.{meta['end_price']:,.0f} | "
            f"Bull:{meta['bull_days']} Bear:{meta['bear_days']} Side:{meta['sideways_days']}"
        )

    print(f"\nDone: {len(STOCKS)} stocks generated with regime-switching model.")


if __name__ == "__main__":
    main()
