"""
Vectorized Risk Metrics
=======================
Port of calculateSharpeRatio, calculateCAGR, calculateAlpha,
calculateInformationRatio from SimulationEngine.js:334-394.

All heavy math uses NumPy for vectorized performance.
"""

import numpy as np

RISK_FREE_RATE = 0.065   # India 10Y ~6.5%
TRADING_DAYS = 252


def sharpe_ratio(equity_curve: np.ndarray) -> float:
    """
    Annualized Sharpe ratio using population stddev.
    Matches JS: (annReturn - Rf) / annStdDev
    """
    if len(equity_curve) < 2:
        return 0.0

    daily_returns = np.diff(equity_curve) / equity_curve[:-1]

    mean_ret = np.mean(daily_returns)
    std_ret = np.std(daily_returns)  # population stddev (ddof=0)

    if std_ret == 0:
        return 0.0

    ann_return = mean_ret * TRADING_DAYS
    ann_std = std_ret * np.sqrt(TRADING_DAYS)

    return float((ann_return - RISK_FREE_RATE) / ann_std)


def max_drawdown(equity_curve: np.ndarray) -> float:
    """
    Maximum drawdown as a fraction (e.g., -0.22 = -22%).
    Uses vectorized peak tracking.
    """
    if len(equity_curve) < 2:
        return 0.0

    peaks = np.maximum.accumulate(equity_curve)
    drawdowns = (equity_curve - peaks) / peaks

    return float(np.min(drawdowns))


def cagr(initial_capital: float, final_value: float, num_candles: int) -> float:
    """
    Compound Annual Growth Rate.
    years = num_candles / 252 (matching JS)
    """
    years = num_candles / TRADING_DAYS
    if years <= 0 or initial_capital <= 0:
        return 0.0

    return float((pow(final_value / initial_capital, 1.0 / years) - 1) * 100)


def benchmark_cagr(initial_price: float, final_price: float, num_candles: int) -> float:
    """Buy-and-hold CAGR based on raw price change."""
    years = num_candles / TRADING_DAYS
    if years <= 0 or initial_price <= 0:
        return 0.0

    return float((pow(final_price / initial_price, 1.0 / years) - 1) * 100)


def alpha(strategy_cagr: float, bench_cagr: float) -> float:
    """Alpha = strategy CAGR - benchmark CAGR."""
    return strategy_cagr - bench_cagr


def information_ratio(equity_curve: np.ndarray, close_prices: np.ndarray) -> float:
    """
    Information ratio: annualized excess return / tracking error.
    Matches JS: SimulationEngine.js:376-394.
    """
    if len(equity_curve) < 2 or len(close_prices) < 2:
        return 0.0

    n = min(len(equity_curve), len(close_prices))
    eq = equity_curve[:n]
    px = close_prices[:n]

    strat_returns = np.diff(eq) / eq[:-1]
    bench_returns = np.diff(px) / px[:-1]

    excess = strat_returns - bench_returns

    mean_excess = np.mean(excess)
    tracking_error = np.std(excess) * np.sqrt(TRADING_DAYS)  # population stddev

    if tracking_error == 0:
        return 0.0

    return float((mean_excess * TRADING_DAYS) / tracking_error)
