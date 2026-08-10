"""
Vectorized Risk Metrics
=======================
Single source of truth for every risk-adjusted statistic the product shows.

One convention, applied everywhere (this module used to disagree with the
React client, which computed Sortino and rolling Sharpe with Rf = 0 and a
sample stddev — three conventions displayed side by side):

    * risk-free rate      RISK_FREE_RATE, annual, de-annualized as Rf/252
    * dispersion          population stddev (ddof=0)
    * annualization       mean x 252 for return, sigma x sqrt(252) for risk

All heavy math uses NumPy for vectorized performance.
"""

import numpy as np

RISK_FREE_RATE = 0.065   # India 10Y ~6.5%
TRADING_DAYS = 252
DAILY_RISK_FREE = RISK_FREE_RATE / TRADING_DAYS


def daily_returns(equity_curve: np.ndarray) -> np.ndarray:
    """Simple period-over-period returns, skipping non-positive equity."""
    if len(equity_curve) < 2:
        return np.array([])
    prev = equity_curve[:-1]
    with np.errstate(divide="ignore", invalid="ignore"):
        rets = np.diff(equity_curve) / prev
    return rets[np.isfinite(rets) & (prev > 0)]


def sharpe_ratio(equity_curve: np.ndarray) -> float:
    """
    Annualized Sharpe ratio using population stddev.
    (annualized excess return) / (annualized stddev)
    """
    rets = daily_returns(equity_curve)
    if len(rets) < 2:
        return 0.0

    std_ret = np.std(rets)  # population stddev (ddof=0)
    if std_ret == 0:
        return 0.0

    ann_excess = (np.mean(rets) - DAILY_RISK_FREE) * TRADING_DAYS
    ann_std = std_ret * np.sqrt(TRADING_DAYS)

    return float(ann_excess / ann_std)


def downside_deviation(equity_curve: np.ndarray, target: float = DAILY_RISK_FREE) -> float:
    """
    Textbook downside deviation, annualized:

        DD = sqrt( (1/N) * SUM_over_all_t  min(r_t - target, 0)^2 ) * sqrt(252)

    Two details that are easy to get wrong and were wrong client-side:
    the sum runs over EVERY period (not just the losing ones), and the
    deviation is measured from the target return, not from the mean of the
    losses. Dividing by only the count of negative periods inflates the
    denominator and makes Sortino look better than it is.
    """
    rets = daily_returns(equity_curve)
    if len(rets) < 2:
        return 0.0
    shortfall = np.minimum(rets - target, 0.0)
    return float(np.sqrt(np.mean(shortfall ** 2)) * np.sqrt(TRADING_DAYS))


def sortino_ratio(equity_curve: np.ndarray) -> float:
    """Annualized excess return / annualized downside deviation."""
    rets = daily_returns(equity_curve)
    if len(rets) < 2:
        return 0.0
    dd = downside_deviation(equity_curve)
    if dd == 0:
        return 0.0
    ann_excess = (np.mean(rets) - DAILY_RISK_FREE) * TRADING_DAYS
    return float(ann_excess / dd)


def annualized_return(equity_curve: np.ndarray) -> float:
    """Arithmetic annualized return, in percent."""
    rets = daily_returns(equity_curve)
    if len(rets) < 1:
        return 0.0
    return float(np.mean(rets) * TRADING_DAYS * 100)


def annualized_volatility(equity_curve: np.ndarray) -> float:
    """Annualized stddev of daily returns, in percent."""
    rets = daily_returns(equity_curve)
    if len(rets) < 2:
        return 0.0
    return float(np.std(rets) * np.sqrt(TRADING_DAYS) * 100)


def calmar_ratio(cagr_pct: float, max_drawdown_pct: float) -> float:
    """CAGR / |max drawdown|, both in percent. 0.0 when there is no drawdown."""
    if not max_drawdown_pct:
        return 0.0
    return float(cagr_pct / abs(max_drawdown_pct))


def rolling_sharpe(equity_curve: np.ndarray, window: int = 60) -> list[float]:
    """
    Rolling annualized Sharpe over `window` periods, same Rf convention as
    `sharpe_ratio`. Returns one value per window-end, so the caller aligns
    element j to bar j + window (matching the equity curve's own indexing).
    """
    rets = daily_returns(equity_curve)
    if len(rets) < window:
        return []
    out = []
    for i in range(window - 1, len(rets)):
        w = rets[i - window + 1: i + 1]
        sd = np.std(w)
        out.append(0.0 if sd == 0 else
                   float((np.mean(w) - DAILY_RISK_FREE) * TRADING_DAYS / (sd * np.sqrt(TRADING_DAYS))))
    return out


def value_at_risk(equity_curve: np.ndarray, confidence: float = 0.95) -> float:
    """Historical daily VaR as a positive percentage (the loss tail)."""
    rets = daily_returns(equity_curve)
    if len(rets) < 2:
        return 0.0
    return float(abs(np.percentile(rets, (1 - confidence) * 100)) * 100)


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


def excess_cagr(strategy_cagr: float, bench_cagr: float) -> float:
    """
    Excess CAGR = strategy CAGR - buy-and-hold CAGR.

    Deliberately NOT called alpha. Jensen's alpha is the intercept of
        R_strategy - Rf = a + B (R_benchmark - Rf) + e
    and requires estimating beta. This is a plain return spread with no
    risk adjustment, and the strategy sits in cash roughly half the time
    (see metrics.exposurePct), so it is not beta-neutral either.
    """
    return strategy_cagr - bench_cagr


# Deprecated name kept so older callers keep working; prefer excess_cagr.
alpha = excess_cagr


def jensens_alpha(equity_curve: np.ndarray, benchmark_prices: np.ndarray) -> dict:
    """
    True Jensen's alpha via OLS on excess returns:
        R_s - Rf = alpha + beta (R_b - Rf) + e

    Returns annualized alpha in percent, beta, and the R^2 of the fit.
    """
    n = min(len(equity_curve), len(benchmark_prices))
    if n < 3:
        return {"alpha": 0.0, "beta": 0.0, "rSquared": 0.0}

    rs = daily_returns(np.asarray(equity_curve[:n], dtype=np.float64))
    rb = daily_returns(np.asarray(benchmark_prices[:n], dtype=np.float64))
    m = min(len(rs), len(rb))
    if m < 3:
        return {"alpha": 0.0, "beta": 0.0, "rSquared": 0.0}

    y = rs[:m] - DAILY_RISK_FREE
    x = rb[:m] - DAILY_RISK_FREE

    var_x = np.var(x)
    if var_x == 0:
        return {"alpha": 0.0, "beta": 0.0, "rSquared": 0.0}

    beta = float(np.cov(x, y, ddof=0)[0, 1] / var_x)
    a_daily = float(np.mean(y) - beta * np.mean(x))

    resid = y - (a_daily + beta * x)
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    r2 = 0.0 if ss_tot == 0 else float(1 - np.sum(resid ** 2) / ss_tot)

    return {
        "alpha": a_daily * TRADING_DAYS * 100,   # annualized, percent
        "beta": beta,
        "rSquared": r2,
    }


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
