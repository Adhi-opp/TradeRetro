"""
Correlation Engine (pure pandas/numpy)
======================================
I/O-free math module powering /api/correlation/* endpoints.

All functions accept a wide-format DataFrame indexed by trade_date with
one column per ticker (close prices). They return plain Python dicts
ready to be serialized by FastAPI.

Intentionally separate from the router so it can be unit-tested
without a DB pool.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


# Fraction of `window_days` a ticker must have to stay in the matrix.
# Anything below this gets moved to `excluded_due_to_missing_data`.
MIN_COVERAGE = 0.8


def _log_returns(prices: pd.DataFrame) -> pd.DataFrame:
    """Column-wise log returns. NaN rows are dropped by the caller as needed."""
    return np.log(prices / prices.shift(1))


def compute_corr_matrix(
    prices: pd.DataFrame,
    window_days: int,
) -> dict:
    """
    Pairwise Pearson correlation on the last `window_days` log-returns.

    Tickers with < MIN_COVERAGE * window_days observations get excluded.
    Returns a dict ready for JSON serialization.
    """
    if prices.empty or prices.shape[1] == 0:
        return {
            "tickers": [],
            "matrix": [],
            "window_days": window_days,
            "n_samples": 0,
            "excluded_due_to_missing_data": [],
            "status": "insufficient_data",
            "required": window_days,
            "available": 0,
        }

    tail = prices.tail(window_days + 1)
    returns = _log_returns(tail).iloc[1:]

    min_obs = max(3, int(window_days * MIN_COVERAGE))
    coverage = returns.notna().sum()
    keep = coverage[coverage >= min_obs].index.tolist()
    excluded = [
        {"ticker": t, "observations": int(coverage.get(t, 0)), "required": min_obs}
        for t in returns.columns
        if t not in keep
    ]

    if len(keep) < 2:
        return {
            "tickers": [],
            "matrix": [],
            "window_days": window_days,
            "n_samples": int(returns.shape[0]),
            "excluded_due_to_missing_data": excluded,
            "status": "insufficient_data",
            "required": min_obs,
            "available": int(coverage.max()) if len(coverage) else 0,
        }

    corr = returns[keep].corr(method="pearson")
    corr = corr.fillna(0.0).round(4)

    return {
        "tickers": keep,
        "matrix": corr.values.tolist(),
        "window_days": window_days,
        "n_samples": int(returns.shape[0]),
        "excluded_due_to_missing_data": excluded,
        "status": "ok",
    }


def compute_rolling_corr(
    prices: pd.DataFrame,
    base: str,
    peers: list[str],
    window_days: int,
    lookback_days: int,
) -> dict:
    """
    Rolling-window correlation of `base` vs each `peer`, stepped one bar at a time,
    over the last `lookback_days` of observations.
    """
    if base not in prices.columns:
        return {
            "base": base,
            "window_days": window_days,
            "lookback_days": lookback_days,
            "series": [],
            "status": "insufficient_data",
            "reason": f"base ticker '{base}' not found in warehouse",
        }

    needed = window_days + lookback_days + 1
    tail = prices.tail(needed)
    returns = _log_returns(tail).iloc[1:]

    if returns.shape[0] < window_days + 2:
        return {
            "base": base,
            "window_days": window_days,
            "lookback_days": lookback_days,
            "series": [],
            "status": "insufficient_data",
            "required": window_days + lookback_days,
            "available": int(returns.shape[0]),
        }

    dates = returns.index

    series = []
    excluded = []
    base_ret = returns[base]
    for peer in peers:
        if peer not in returns.columns or peer == base:
            excluded.append(peer)
            continue
        rolling = base_ret.rolling(window_days).corr(returns[peer])
        rolling = rolling.dropna()
        points = [
            {"date": d.date().isoformat() if hasattr(d, "date") else str(d),
             "corr": None if pd.isna(v) else round(float(v), 4)}
            for d, v in rolling.tail(lookback_days).items()
        ]
        series.append({"peer": peer, "points": points})

    return {
        "base": base,
        "window_days": window_days,
        "lookback_days": lookback_days,
        "series": series,
        "excluded_due_to_missing_data": excluded,
        "status": "ok" if series else "insufficient_data",
    }


def compute_lead_lag(
    prices: pd.DataFrame,
    base: str,
    peers: list[str],
    max_lag: int,
    window_bars: int,
) -> dict:
    """
    Lagged-correlation proxy (NOT true Granger causality).

    For each peer and each k in [-max_lag, +max_lag],
    compute corr(base_t, peer_{t-k}) on the last `window_bars` observations.
    Pick k* that maximizes |corr|. If |corr| barely changes across k
    (delta < 0.03), report 'sync'.
    """
    if base not in prices.columns:
        return {
            "base": base,
            "results": [],
            "lead_lag_proxy": True,
            "disclaimer": (
                "Lagged-correlation proxy - not true Granger causality."
                "Positive best_lag_bars means the peer's moves precede the base's."
            ),
            "status": "insufficient_data",
            "reason": f"base ticker '{base}' not found in warehouse",
        }

    tail = prices.tail(window_bars + max_lag + 2)
    returns = _log_returns(tail).iloc[1:]

    if returns.shape[0] < window_bars:
        return {
            "base": base,
            "results": [],
            "lead_lag_proxy": True,
            "disclaimer": (
                "Lagged-correlation proxy - not true Granger causality."
                "Positive best_lag_bars means the peer's moves precede the base's."
            ),
            "status": "insufficient_data",
            "required": window_bars,
            "available": int(returns.shape[0]),
        }

    base_ret = returns[base]
    results = []
    for peer in peers:
        if peer not in returns.columns or peer == base:
            continue

        peer_ret = returns[peer]
        corrs = []
        for k in range(-max_lag, max_lag + 1):
            shifted = peer_ret.shift(k)
            aligned = pd.concat([base_ret, shifted], axis=1).dropna()
            if len(aligned) < 3:
                corrs.append((k, None))
                continue
            c = aligned.iloc[:, 0].corr(aligned.iloc[:, 1])
            corrs.append((k, None if pd.isna(c) else float(c)))

        valid = [(k, c) for k, c in corrs if c is not None]
        if not valid:
            continue

        best_k, best_c = max(valid, key=lambda kc: abs(kc[1]))
        abs_values = [abs(c) for _, c in valid]
        delta = max(abs_values) - min(abs_values)

        if delta < 0.03:
            direction = "sync"
        elif best_k > 0:
            direction = "peer_leads"
        elif best_k < 0:
            direction = "base_leads"
        else:
            direction = "sync"

        results.append({
            "peer": peer,
            "best_lag_bars": int(best_k),
            "corr_at_best": round(best_c, 4),
            "direction": direction,
            "lag_profile": [
                {"lag": k, "corr": None if c is None else round(c, 4)} for k, c in corrs
            ],
        })

    return {
        "base": base,
        "max_lag": max_lag,
        "window_bars": window_bars,
        "results": results,
        "lead_lag_proxy": True,
        "disclaimer": (
            "Lagged-correlation proxy - not true Granger causality."
            "Positive best_lag_bars means the peer's moves precede the base's."
        ),
        "status": "ok" if results else "insufficient_data",
    }


def compute_divergence(
    prices: pd.DataFrame,
    base: str,
    peers: list[str],
    lookback_days: int,
) -> dict:
    """
    Normalized cumulative % change vs the first observation in the window.
    Shows relative drift of each peer against the index/base.
    """
    if base not in prices.columns:
        return {
            "base": base,
            "lookback_days": lookback_days,
            "series": [],
            "status": "insufficient_data",
            "reason": f"base ticker '{base}' not found in warehouse",
        }

    wanted = [base] + [p for p in peers if p in prices.columns and p != base]
    tail = prices[wanted].tail(lookback_days)
    tail = tail.dropna(how="all")

    if tail.shape[0] < 2:
        return {
            "base": base,
            "lookback_days": lookback_days,
            "series": [],
            "status": "insufficient_data",
            "required": lookback_days,
            "available": int(tail.shape[0]),
        }

    series = []
    for ticker in wanted:
        col = tail[ticker].dropna()
        if len(col) < 2:
            continue
        anchor = col.iloc[0]
        cum_pct = ((col / anchor) - 1.0) * 100.0
        points = [
            {"date": d.date().isoformat() if hasattr(d, "date") else str(d),
             "cum_pct": round(float(v), 4)}
            for d, v in cum_pct.items()
        ]
        series.append({"ticker": ticker, "points": points})

    return {
        "base": base,
        "lookback_days": lookback_days,
        "as_of": tail.index[-1].date().isoformat() if hasattr(tail.index[-1], "date") else str(tail.index[-1]),
        "series": series,
        "status": "ok" if series else "insufficient_data",
    }
