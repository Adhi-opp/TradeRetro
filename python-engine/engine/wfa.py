"""
Walk-Forward Analysis (WFA) engine.
=====================================
A parameter sweep that optimizes over the WHOLE sample and reports the best
Sharpe is curve-fitting — it guarantees an in-sample winner that may be noise.
WFA answers "does this survive out-of-sample?":

    for each rolling fold:
        TRAIN window  → pick the best candidate params (in-sample)
        TEST window   → run those params on the *next*, unseen bars (OOS)
    stitch the OOS test segments into one continuous equity curve

The headline is the **walk-forward efficiency ratio** = aggregate OOS metric ÷
mean in-sample metric. Near 1.0 ⇒ the edge generalizes; near 0 (or negative)
⇒ the in-sample optimization was fitting noise.

Reuses SimulationEngine, so OOS runs honor the exact same next-bar-open fills,
costs, and (optional) risk model as a normal backtest.
"""

import numpy as np

from engine import metrics as m
from engine.simulation import SimulationEngine


def strategy_warmup(strategy_type: str, params: dict) -> int:
    """Bars of history an indicator needs before it can emit a signal."""
    if strategy_type == "MOVING_AVERAGE_CROSSOVER":
        return int(params.get("longPeriod", 50))
    if strategy_type == "RSI":
        return int(params.get("rsiPeriod", 14)) + 1
    if strategy_type == "MACD":
        return 35
    if strategy_type == "BOLLINGER_BREAKOUT":
        return int(params.get("bbPeriod", 20))
    if strategy_type == "DONCHIAN_BREAKOUT":
        return int(params.get("dcPeriod", 20)) + 1
    return 50


def generate_folds(n_visible: int, train_bars: int, test_bars: int, step: int | None = None) -> list[dict]:
    """
    Rolling train/test index folds over a window of n_visible bars.

    Default step = test_bars → non-overlapping OOS test segments (anchored
    walk-forward), so the stitched OOS curve has no double-counted bars.
    Indices are relative to the start of the visible window.
    """
    step = step or test_bars
    folds = []
    i = 0
    while i + train_bars + test_bars <= n_visible:
        folds.append({
            "train": (i, i + train_bars),
            "test": (i + train_bars, i + train_bars + test_bars),
        })
        i += step
    return folds


def _metric(result: dict, name: str):
    mm = result.get("metrics") or {}
    if name == "sharpe":
        return mm.get("sharpeRatio")
    if name == "totalReturn":
        return mm.get("totalReturn")
    if name == "calmar":
        cagr = mm.get("cagr")
        mdd = mm.get("maxDrawdown")
        if cagr is None or not mdd:
            return None
        return float(cagr) / abs(float(mdd))
    return None


def _run_window(market_data, strategy_type, params, vs, ve, warmup):
    """Run a backtest over visible bars [vs, ve) with `warmup` bars before vs.

    Returns None on any failure (e.g. a nonsensical candidate) so one bad
    parameter set skips rather than aborting the whole analysis.
    """
    slice_start = max(0, vs - warmup)
    sub = market_data[slice_start:ve]
    local_visible = vs - slice_start
    if local_visible >= len(sub):
        return None
    try:
        engine = SimulationEngine(
            sub, params["initialCapital"],
            {"strategyType": strategy_type, "params": params},
            visible_start_index=local_visible,
        )
        return engine.run()
    except Exception:
        return None


def _stitch(running_capital: float, curve: list[dict]) -> tuple[list[dict], float]:
    """Chain a fold's OOS equity curve onto the running capital (compounding)."""
    if not curve:
        return [], running_capital
    base = curve[0]["equity"] or running_capital
    out = []
    end_capital = running_capital
    for p in curve:
        factor = (p["equity"] / base) if base else 1.0
        val = running_capital * factor
        out.append({"date": p["date"], "equity": val})
        end_capital = val
    return out, end_capital


def run_wfa(
    market_data: list[dict],
    visible_start: int,
    strategy_type: str,
    base_params: dict,
    candidates: list[dict],
    train_bars: int,
    test_bars: int,
    metric: str = "sharpe",
    step: int | None = None,
) -> dict:
    """
    Execute walk-forward analysis. Returns per-fold results, the stitched OOS
    equity curve, and a summary with the efficiency ratio + verdict.
    """
    if not candidates:
        raise ValueError("WFA needs at least one candidate parameter set")

    warmup = max(strategy_warmup(strategy_type, {**base_params, **c}) for c in candidates)
    n_visible = len(market_data) - visible_start
    rel_folds = generate_folds(n_visible, train_bars, test_bars, step)

    if not rel_folds:
        return {
            "folds": [], "stitchedOOS": [],
            "summary": {
                "metric": metric, "folds": 0,
                "reason": (
                    f"Not enough data: need ≥ {train_bars + test_bars} visible bars "
                    f"for one fold, have {n_visible}. Backfill more history or shrink the windows."
                ),
            },
        }

    initial_capital = base_params["initialCapital"]
    fold_records = []
    stitched: list[dict] = []
    running_capital = initial_capital
    is_metrics, oos_metrics = [], []

    for k, fold in enumerate(rel_folds, start=1):
        tr_vs = visible_start + fold["train"][0]
        tr_ve = visible_start + fold["train"][1]
        te_vs = visible_start + fold["test"][0]
        te_ve = visible_start + fold["test"][1]

        # ── Train: pick the in-sample best candidate ──
        best_c, best_is = None, None
        for c in candidates:
            params = {**base_params, **c}
            res = _run_window(market_data, strategy_type, params, tr_vs, tr_ve, warmup)
            if res is None:
                continue
            mv = _metric(res, metric)
            if mv is None or (isinstance(mv, float) and mv != mv):  # None / NaN
                continue
            if best_is is None or mv > best_is:
                best_is, best_c = mv, c
        if best_c is None:
            continue

        # ── Test: those params on the next, unseen bars (OOS) ──
        test_params = {**base_params, **best_c}
        test_res = _run_window(market_data, strategy_type, test_params, te_vs, te_ve, warmup)
        if test_res is None:
            continue
        oos_mv = _metric(test_res, metric)
        tm = test_res["metrics"]

        seg, running_capital = _stitch(running_capital, test_res.get("equityCurve", []))
        stitched.extend(seg)

        oos_trades = int(tm.get("totalTrades", 0))

        # Only folds that actually traded out-of-sample carry information about
        # generalization. A fold with zero OOS trades is flat cash, and flat
        # cash scored against a 6.5% risk-free rate yields a negative Sharpe —
        # including those would measure "how often the strategy sat out", not
        # "did the in-sample edge survive".
        if oos_trades > 0:
            is_metrics.append(best_is)
            if oos_mv is not None and oos_mv == oos_mv:
                oos_metrics.append(oos_mv)

        fold_records.append({
            "fold": k,
            "active": oos_trades > 0,
            "trainStart": market_data[tr_vs]["date"] if tr_vs < len(market_data) else None,
            "trainEnd": market_data[tr_ve - 1]["date"] if tr_ve - 1 < len(market_data) else None,
            "testStart": market_data[te_vs]["date"] if te_vs < len(market_data) else None,
            "testEnd": market_data[te_ve - 1]["date"] if te_ve - 1 < len(market_data) else None,
            "bestParams": best_c,
            "isMetric": round(float(best_is), 4),
            "oosMetric": round(float(oos_mv), 4) if oos_mv is not None else None,
            "oosReturn": round(float(tm.get("totalReturn", 0)), 2),
            "oosTrades": oos_trades,
        })

    # ── Aggregate OOS performance on the stitched curve ──
    summary = _summarize(stitched, initial_capital, is_metrics, oos_metrics, metric, fold_records)
    return {"folds": fold_records, "stitchedOOS": stitched, "summary": summary}


def _summarize(stitched, initial_capital, is_metrics, oos_metrics, metric, fold_records) -> dict:
    """
    Build the WFA summary.

    The efficiency ratio compares LIKE WITH LIKE: mean out-of-sample metric
    across active folds, over mean in-sample metric across the same folds.
    The earlier version divided the Sharpe of the *stitched aggregate* curve
    by the *mean of per-fold* in-sample Sharpes — two different estimators
    over different sample sizes, so the ratio was neither bounded nor
    interpretable, and it was dominated by folds that never traded.
    """
    n_folds = len(fold_records)
    active_folds = sum(1 for f in fold_records if f.get("active"))
    idle_folds = n_folds - active_folds

    mean_is = float(np.mean(is_metrics)) if is_metrics else None
    mean_oos = float(np.mean(oos_metrics)) if oos_metrics else None

    if len(stitched) >= 2:
        eq = np.array([p["equity"] for p in stitched], dtype=np.float64)
        oos_sharpe = m.sharpe_ratio(eq)
        oos_total_return = float((eq[-1] - initial_capital) / initial_capital * 100)
        oos_max_dd = float(m.max_drawdown(eq) * 100)
    else:
        oos_sharpe = oos_total_return = oos_max_dd = 0.0

    efficiency = None
    if mean_is is not None and mean_oos is not None and mean_is > 0:
        # A non-positive mean in-sample metric means the optimizer never found
        # an edge to begin with, so there is nothing for OOS to "retain" — the
        # ratio would flip sign and read as spuriously strong.
        efficiency = float(mean_oos / mean_is)

    if efficiency is None or active_folds < 3:
        verdict = "inconclusive"
    elif efficiency >= 0.5:
        verdict = "robust"
    elif efficiency >= 0.2:
        verdict = "marginal"
    else:
        verdict = "overfit"

    reason = None
    if efficiency is None:
        reason = ("No positive in-sample edge to test — the optimizer's best "
                  "candidate had a non-positive metric on the train windows.")
    elif active_folds < 3:
        reason = (f"Only {active_folds} of {n_folds} folds traded out-of-sample; "
                  f"too few active folds to judge robustness.")

    return {
        "metric": metric,
        "folds": n_folds,
        "activeFolds": active_folds,
        "idleFolds": idle_folds,
        "meanInSample": round(mean_is, 4) if mean_is is not None else None,
        "meanOutOfSample": round(mean_oos, 4) if mean_oos is not None else None,
        # Realized performance of the stitched OOS curve — reported alongside
        # the ratio so a positive return with a shallow drawdown can't be
        # hidden behind an "overfit" label.
        "oosSharpe": round(float(oos_sharpe), 4),
        "oosTotalReturn": round(oos_total_return, 2),
        "oosMaxDrawdown": round(oos_max_dd, 2),
        "wfaEfficiency": round(efficiency, 3) if efficiency is not None else None,
        "verdict": verdict,
        "reason": reason,
    }
