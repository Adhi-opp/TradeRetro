"""
Stationary block bootstrap for backtest statistics.
====================================================
A single backtest gives one number. "Sharpe 0.29" says nothing about whether
that 0.29 is distinguishable from zero, and with ~2,100 daily observations and
19 trades it very often is not. This module attaches a confidence interval and
a p-value to the headline statistics so the claim can be defended.

Why the *stationary* block bootstrap (Politis & Romano, 1994) rather than an
i.i.d. resample: daily returns are serially dependent — volatility clusters,
and a strategy that sits in cash produces runs of exact zeros. Resampling
individual days destroys that structure and yields intervals that are far too
narrow. Sampling geometrically-distributed blocks preserves short-range
dependence, and the geometric length (rather than a fixed block) keeps the
resampled series stationary, which fixed-block methods do not.

    block length L ~ Geometric(1/mean_block), wrapped circularly
    B resamples, each of the same length as the original series
    statistic recomputed on every resample
    95% CI = the 2.5th and 97.5th percentiles of that distribution

The null is "no edge": H0 says the statistic is <= 0. The reported p-value is
the two-sided bootstrap proportion, which is the conservative choice.
"""

import numpy as np

from engine.metrics import DAILY_RISK_FREE, TRADING_DAYS, daily_returns

DEFAULT_RESAMPLES = 1000
DEFAULT_MEAN_BLOCK = 10      # trading days — roughly two weeks
DEFAULT_CONFIDENCE = 0.95


# ── Statistics computed on a resampled return series ─────────────────────────

def _sharpe_of(rets: np.ndarray) -> float:
    sd = np.std(rets)
    if sd == 0:
        return 0.0
    return float((np.mean(rets) - DAILY_RISK_FREE) * TRADING_DAYS / (sd * np.sqrt(TRADING_DAYS)))


def _cagr_of(rets: np.ndarray) -> float:
    """Geometric annualized growth of the resampled path, in percent."""
    growth = float(np.prod(1.0 + rets))
    if growth <= 0:
        return -100.0
    years = len(rets) / TRADING_DAYS
    if years <= 0:
        return 0.0
    return float((growth ** (1.0 / years) - 1.0) * 100.0)


def _total_return_of(rets: np.ndarray) -> float:
    return float((np.prod(1.0 + rets) - 1.0) * 100.0)


STATISTICS = {
    "sharpe": _sharpe_of,
    "cagr": _cagr_of,
    "totalReturn": _total_return_of,
}


# ── Resampling ───────────────────────────────────────────────────────────────

def stationary_bootstrap_indices(n: int, mean_block: int, rng: np.random.Generator) -> np.ndarray:
    """
    One stationary-bootstrap index path of length n.

    Walk forward from a random start; at each step, with probability
    1/mean_block begin a new block at a fresh random position, otherwise
    continue the current block. Indices wrap modulo n (circular bootstrap),
    so every observation has equal selection probability.
    """
    if n <= 0:
        return np.array([], dtype=np.int64)

    p = 1.0 / max(1, mean_block)
    idx = np.empty(n, dtype=np.int64)
    cur = int(rng.integers(0, n))

    # Vectorized coin flips: True starts a new block.
    restarts = rng.random(n) < p
    starts = rng.integers(0, n, size=n)

    for i in range(n):
        if i > 0:
            cur = int(starts[i]) if restarts[i] else (cur + 1) % n
        idx[i] = cur
    return idx


def bootstrap_distribution(
    returns: np.ndarray,
    statistic: str = "sharpe",
    resamples: int = DEFAULT_RESAMPLES,
    mean_block: int = DEFAULT_MEAN_BLOCK,
    seed: int | None = 42,
) -> np.ndarray:
    """Bootstrap sampling distribution of `statistic` over the return series."""
    fn = STATISTICS[statistic]
    n = len(returns)
    if n < 3:
        return np.array([])

    rng = np.random.default_rng(seed)
    out = np.empty(resamples, dtype=np.float64)
    for b in range(resamples):
        idx = stationary_bootstrap_indices(n, mean_block, rng)
        out[b] = fn(returns[idx])
    return out


# ── Public API ───────────────────────────────────────────────────────────────

def confidence_interval(
    equity_curve,
    statistic: str = "sharpe",
    resamples: int = DEFAULT_RESAMPLES,
    mean_block: int = DEFAULT_MEAN_BLOCK,
    confidence: float = DEFAULT_CONFIDENCE,
    seed: int | None = 42,
) -> dict:
    """
    Point estimate, bootstrap CI and p-value for one statistic.

    Returns keys: statistic, point, ciLow, ciHigh, pValue, significant,
    resamples, meanBlock, confidence, standardError.
    `significant` is True when the interval excludes zero.
    """
    equity = np.asarray(equity_curve, dtype=np.float64)
    rets = daily_returns(equity)

    empty = {
        "statistic": statistic, "point": None, "ciLow": None, "ciHigh": None,
        "pValue": None, "significant": False, "resamples": 0,
        "meanBlock": mean_block, "confidence": confidence, "standardError": None,
    }
    if len(rets) < 3:
        return empty

    point = STATISTICS[statistic](rets)
    dist = bootstrap_distribution(rets, statistic, resamples, mean_block, seed)
    if dist.size == 0:
        return {**empty, "point": round(point, 4)}

    lo_pct = (1 - confidence) / 2 * 100
    hi_pct = (1 + confidence) / 2 * 100
    ci_low = float(np.percentile(dist, lo_pct))
    ci_high = float(np.percentile(dist, hi_pct))

    # Two-sided bootstrap p-value for H0: statistic = 0.
    frac_below = float(np.mean(dist <= 0.0))
    frac_above = float(np.mean(dist >= 0.0))
    p_value = min(1.0, 2.0 * min(frac_below, frac_above))

    return {
        "statistic": statistic,
        "point": round(point, 4),
        "ciLow": round(ci_low, 4),
        "ciHigh": round(ci_high, 4),
        "pValue": round(p_value, 4),
        "significant": bool(ci_low > 0 or ci_high < 0),
        "standardError": round(float(np.std(dist)), 4),
        "resamples": int(dist.size),
        "meanBlock": mean_block,
        "confidence": confidence,
    }


def significance_report(
    equity_curve,
    statistics: list[str] | None = None,
    resamples: int = DEFAULT_RESAMPLES,
    mean_block: int = DEFAULT_MEAN_BLOCK,
    confidence: float = DEFAULT_CONFIDENCE,
    seed: int | None = 42,
) -> dict:
    """CIs for several statistics plus a one-line verdict for the UI."""
    statistics = statistics or ["sharpe", "cagr"]
    results = {
        s: confidence_interval(equity_curve, s, resamples, mean_block, confidence, seed)
        for s in statistics
    }

    sharpe = results.get("sharpe") or {}
    if sharpe.get("point") is None:
        verdict, reason = "insufficient_data", "Not enough return observations to resample."
    elif sharpe.get("significant"):
        direction = "positive" if sharpe["ciLow"] > 0 else "negative"
        verdict = f"significant_{direction}"
        reason = (f"95% CI [{sharpe['ciLow']}, {sharpe['ciHigh']}] excludes zero "
                  f"(p = {sharpe['pValue']}).")
    else:
        verdict = "not_distinguishable_from_zero"
        reason = (f"95% CI [{sharpe['ciLow']}, {sharpe['ciHigh']}] contains zero "
                  f"(p = {sharpe['pValue']}) — the observed Sharpe of "
                  f"{sharpe['point']} is within sampling noise.")

    return {
        "method": "stationary block bootstrap (Politis & Romano 1994)",
        "resamples": resamples,
        "meanBlockDays": mean_block,
        "confidence": confidence,
        "seed": seed,
        "results": results,
        "verdict": verdict,
        "reason": reason,
    }
