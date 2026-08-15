"""
Full strategy x universe grid, cost sensitivity, and significance testing.
==========================================================================
Reproducible evidence for the project's central claim:

    Classical technical strategies on NSE large-caps do not generate positive
    alpha once realistic Indian statutory costs and market friction are
    applied, and the shortfall scales with turnover.

Ten hand-picked backtests are an anecdote. This runs every strategy against
every ticker in the warehouse, so the claim rests on a distribution.

Three outputs, written to docs/research/:
    1. grid          — 5 strategies x N tickers, net and gross
    2. cost curve    — the same grid re-run at 0x .. 2x the cost model, which
                       locates the slippage assumption at which each strategy
                       breaks even
    3. significance  — stationary block bootstrap CI on every cell's Sharpe

Run:
    docker compose exec api python -m research.strategy_grid
    python -m research.strategy_grid --tickers RELIANCE.NS,TCS.NS --quick
"""

import argparse
import asyncio
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from engine import costs as costs_mod                      # noqa: E402
from engine.bootstrap import confidence_interval           # noqa: E402
from engine.simulation import SimulationEngine             # noqa: E402
from services.data_loader import load_historical_data      # noqa: E402
from services.db import init_pool, close_pool              # noqa: E402
from config import settings                                # noqa: E402

START_DATE = "2018-01-01"
END_DATE = "2026-08-07"
CAPITAL = 100_000
SEED = 42

# One representative parameterization per strategy. Deliberately the textbook
# defaults — tuning them per ticker would be the curve-fitting this project
# exists to argue against.
STRATEGIES = {
    "MA 20/50": ("MOVING_AVERAGE_CROSSOVER", {"shortPeriod": 20, "longPeriod": 50}),
    "MA 50/200": ("MOVING_AVERAGE_CROSSOVER", {"shortPeriod": 50, "longPeriod": 200}),
    "RSI 14": ("RSI", {"rsiPeriod": 14, "oversold": 30, "overbought": 70}),
    "MACD": ("MACD", {}),
    "Bollinger 20/2": ("BOLLINGER_BREAKOUT", {"bbPeriod": 20, "bbStdDev": 2.0}),
    "Donchian 20": ("DONCHIAN_BREAKOUT", {"dcPeriod": 20}),
}

# Multipliers applied to every component of the Indian cost model.
COST_MULTIPLIERS = [0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0]

OUT_DIR = Path(__file__).resolve().parents[2] / "docs" / "research"


# ── cost-model scaling ───────────────────────────────────────────────────────

_BASE_COSTS = dict(costs_mod.INDIA_EQUITY_COSTS)


def scale_costs(multiplier: float) -> None:
    """
    Scale every cost component. GST is a rate on other charges, not a turnover
    cost, so it is left alone — scaling it would double-count.
    """
    scaled = {}
    for k, v in _BASE_COSTS.items():
        scaled[k] = v if k == "gst" else v * multiplier
    costs_mod.INDIA_EQUITY_COSTS.clear()
    costs_mod.INDIA_EQUITY_COSTS.update(scaled)


def restore_costs() -> None:
    costs_mod.INDIA_EQUITY_COSTS.clear()
    costs_mod.INDIA_EQUITY_COSTS.update(_BASE_COSTS)


# ── grid ─────────────────────────────────────────────────────────────────────

def _min_candles(strategy_type: str, params: dict) -> int:
    return {
        "MOVING_AVERAGE_CROSSOVER": params.get("longPeriod", 50),
        "RSI": params.get("rsiPeriod", 14) + 1,
        "MACD": 35,
        "BOLLINGER_BREAKOUT": params.get("bbPeriod", 20),
        "DONCHIAN_BREAKOUT": params.get("dcPeriod", 20) + 1,
    }[strategy_type]


async def load_market(ticker: str, warmup: int):
    window = await load_historical_data(
        ticker=ticker, start_date=START_DATE, end_date=END_DATE, warmup_candles=warmup,
    )
    md = []
    for _, row in window.frame.iterrows():
        md.append({
            "date": row["date"].isoformat() if hasattr(row["date"], "isoformat") else str(row["date"]),
            "open": float(row["open"]), "high": float(row["high"]),
            "low": float(row["low"]), "close": float(row["close"]),
            "volume": int(row["volume"]) if row["volume"] else 0,
        })
    return md, window.visible_start_index


def run_cell(market_data, visible_start, strategy_type, params) -> dict | None:
    cfg = {"strategyType": strategy_type,
           "params": {**params, "initialCapital": CAPITAL, "seed": SEED}}
    try:
        return SimulationEngine(
            market_data, CAPITAL, cfg, visible_start_index=visible_start
        ).run()
    except Exception:
        return None


async def build_grid(tickers: list[str], with_significance: bool, resamples: int) -> list[dict]:
    rows = []
    for ticker in tickers:
        max_warmup = max(_min_candles(st, p) for st, p in STRATEGIES.values())
        try:
            market_data, visible_start = await load_market(ticker, max_warmup)
        except Exception as exc:
            print(f"  ! {ticker}: {exc}")
            continue

        for label, (stype, params) in STRATEGIES.items():
            res = run_cell(market_data, visible_start, stype, params)
            if res is None:
                continue
            m, g, c = res["metrics"], res["grossMetrics"], res["costBreakdown"]

            row = {
                "ticker": ticker,
                "strategy": label,
                "netReturn": round(m["totalReturn"], 2),
                "grossReturn": round(g["totalReturn"], 2),
                "costDragPp": round(g["totalReturn"] - m["totalReturn"], 2),
                "buyHoldReturn": round(m["buyHoldReturn"], 2),
                "excessCagr": round(m["excessCagr"], 2),
                "jensensAlpha": round(m["jensensAlpha"], 2),
                "beta": round(m["beta"], 3),
                "cagr": round(m["cagr"], 2),
                "sharpe": round(m["sharpeRatio"], 4),
                "sortino": round(m["sortinoRatio"], 4),
                "maxDrawdown": round(m["maxDrawdown"], 2),
                "trades": m["totalTrades"],
                "winRate": round(m["winRate"], 1),
                "exposurePct": round(m["exposurePct"], 1),
                "totalCosts": round(c["totalCosts"], 0),
                "costPctOfCapital": c["costPctOfCapital"],
                "beatsBuyHold": m["totalReturn"] > m["buyHoldReturn"],
            }

            if with_significance:
                equity = [p["equity"] for p in res["equityCurve"]]
                ci = confidence_interval(equity, "sharpe", resamples=resamples, seed=SEED)
                row |= {
                    "sharpeCiLow": ci["ciLow"],
                    "sharpeCiHigh": ci["ciHigh"],
                    "sharpePValue": ci["pValue"],
                    "sharpeSignificant": ci["significant"],
                }

            rows.append(row)
        print(f"  {ticker:<15} {len(STRATEGIES)} strategies")
    return rows


async def build_cost_curve(tickers: list[str]) -> list[dict]:
    """Re-run the grid at each cost multiplier; report mean net return."""
    out = []
    cache = {}
    for ticker in tickers:
        max_warmup = max(_min_candles(st, p) for st, p in STRATEGIES.values())
        try:
            cache[ticker] = await load_market(ticker, max_warmup)
        except Exception:
            continue

    for mult in COST_MULTIPLIERS:
        scale_costs(mult)
        try:
            for label, (stype, params) in STRATEGIES.items():
                nets, drags, trades = [], [], []
                for ticker, (md, vs) in cache.items():
                    res = run_cell(md, vs, stype, params)
                    if res is None:
                        continue
                    m, g = res["metrics"], res["grossMetrics"]
                    nets.append(m["totalReturn"])
                    drags.append(g["totalReturn"] - m["totalReturn"])
                    trades.append(m["totalTrades"])
                if not nets:
                    continue
                out.append({
                    "costMultiplier": mult,
                    "strategy": label,
                    "meanNetReturn": round(sum(nets) / len(nets), 2),
                    "meanCostDragPp": round(sum(drags) / len(drags), 2),
                    "meanTrades": round(sum(trades) / len(trades), 1),
                    "tickers": len(nets),
                })
        finally:
            restore_costs()
        print(f"  cost x{mult:<5} done")
    return out


# ── reporting ────────────────────────────────────────────────────────────────

def write_markdown(grid: list[dict], curve: list[dict], meta: dict, path: Path) -> None:
    n = len(grid)
    beat = sum(1 for r in grid if r["beatsBuyHold"])
    pos_alpha = sum(1 for r in grid if r["excessCagr"] > 0)
    pos_jensen = sum(1 for r in grid if r["jensensAlpha"] > 0)
    sig = [r for r in grid if r.get("sharpeSignificant")]
    sig_pos = [r for r in sig if r["sharpe"] > 0]

    L = []
    L.append(f"# Strategy Grid — {meta['generatedAt'][:10]}\n")
    L.append(f"{len(STRATEGIES)} strategies x {meta['tickers']} tickers = **{n} backtests**, "
             f"{START_DATE} to {END_DATE}, Rs {CAPITAL:,} initial capital, seed {SEED}, "
             f"net of the modelled Indian cost stack.\n")

    L.append("## Headline\n")
    L.append("| Result | Count | Share |")
    L.append("|---|---:|---:|")
    L.append(f"| Beat buy-and-hold (total return) | {beat} / {n} | {100*beat/n:.1f}% |")
    L.append(f"| Positive excess CAGR | {pos_alpha} / {n} | {100*pos_alpha/n:.1f}% |")
    L.append(f"| Positive Jensen's alpha | {pos_jensen} / {n} | {100*pos_jensen/n:.1f}% |")
    L.append(f"| Sharpe distinguishable from zero | {len(sig)} / {n} | {100*len(sig)/n:.1f}% |")
    L.append(f"| ...and positive | {len(sig_pos)} / {n} | {100*len(sig_pos)/n:.1f}% |")
    L.append("")

    L.append("## Per strategy (mean across tickers)\n")
    L.append("| Strategy | Net % | B&H % | Excess CAGR | Jensen α | β | Trades | Cost drag (pp) | Beat B&H |")
    L.append("|---|---:|---:|---:|---:|---:|---:|---:|---:|")
    for label in STRATEGIES:
        rows = [r for r in grid if r["strategy"] == label]
        if not rows:
            continue
        k = len(rows)
        avg = lambda f: sum(r[f] for r in rows) / k   # noqa: E731
        L.append(
            f"| {label} | {avg('netReturn'):.1f} | {avg('buyHoldReturn'):.1f} | "
            f"{avg('excessCagr'):.2f} | {avg('jensensAlpha'):.2f} | {avg('beta'):.2f} | "
            f"{avg('trades'):.0f} | {avg('costDragPp'):.1f} | "
            f"{sum(1 for r in rows if r['beatsBuyHold'])}/{k} |"
        )
    L.append("")

    L.append("## Turnover vs cost drag\n")
    L.append("Every cell, sorted by round trips. This is the mechanism behind the headline.\n")
    L.append("| Strategy | Ticker | Trades | Cost drag (pp) | Costs (Rs) | Net % |")
    L.append("|---|---|---:|---:|---:|---:|")
    for r in sorted(grid, key=lambda x: -x["trades"])[:15]:
        L.append(f"| {r['strategy']} | {r['ticker']} | {r['trades']} | {r['costDragPp']:.1f} | "
                 f"{r['totalCosts']:,.0f} | {r['netReturn']:.1f} |")
    L.append("")

    if curve:
        L.append("## Cost sensitivity\n")
        L.append("Mean net return across the universe as the whole cost model is scaled. "
                 "`x0` is the frictionless world; `x1` is the modelled reality.\n")
        mults = sorted({c["costMultiplier"] for c in curve})
        L.append("| Strategy | " + " | ".join(f"x{m}" for m in mults) + " |")
        L.append("|---|" + "---:|" * len(mults))
        for label in STRATEGIES:
            cells = []
            for m in mults:
                hit = next((c for c in curve if c["strategy"] == label and c["costMultiplier"] == m), None)
                cells.append(f"{hit['meanNetReturn']:.1f}" if hit else "—")
            L.append(f"| {label} | " + " | ".join(cells) + " |")
        L.append("")

    L.append("## Method\n")
    L.append("- Signals computed on bar *i*'s close, filled at bar *i+1*'s open. No look-ahead.")
    L.append("- Costs: STT, brokerage, exchange txn, GST, SEBI fee, stamp duty, "
             "and stochastic slippage from a seeded PRNG.")
    L.append(f"- Significance: stationary block bootstrap, {meta['resamples']} resamples, "
             f"mean block {meta['meanBlockDays']} days, 95% interval.")
    L.append("- Parameters are textbook defaults, identical across tickers — no per-ticker tuning.")
    L.append(f"\nGenerated by `python -m research.strategy_grid` in {meta['elapsedSeconds']}s.")

    path.write_text("\n".join(L), encoding="utf-8")


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tickers", help="comma-separated; default = whole warehouse")
    ap.add_argument("--quick", action="store_true", help="skip bootstrap + cost curve")
    ap.add_argument("--resamples", type=int, default=500)
    args = ap.parse_args()

    t0 = time.time()
    await init_pool(settings.database_url)
    try:
        if args.tickers:
            tickers = [t.strip().upper() for t in args.tickers.split(",")]
        else:
            from services.db import get_pool
            async with get_pool().acquire() as conn:
                rows = await conn.fetch(
                    "SELECT DISTINCT ticker FROM raw.historical_prices ORDER BY ticker"
                )
            tickers = [r["ticker"] for r in rows]

        print(f"Grid: {len(STRATEGIES)} strategies x {len(tickers)} tickers "
              f"= {len(STRATEGIES) * len(tickers)} backtests")
        grid = await build_grid(tickers, with_significance=not args.quick,
                                resamples=args.resamples)

        curve = []
        if not args.quick:
            print("Cost sensitivity sweep...")
            curve = await build_cost_curve(tickers)
    finally:
        await close_pool()

    meta = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "startDate": START_DATE, "endDate": END_DATE,
        "capital": CAPITAL, "seed": SEED,
        "strategies": len(STRATEGIES), "tickers": len(tickers),
        "backtests": len(grid),
        "resamples": args.resamples, "meanBlockDays": 10,
        "elapsedSeconds": round(time.time() - t0, 1),
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    json_path = OUT_DIR / f"strategy-grid-{stamp}.json"
    md_path = OUT_DIR / f"strategy-grid-{stamp}.md"

    json_path.write_text(json.dumps(
        {"meta": meta, "grid": grid, "costCurve": curve}, indent=2), encoding="utf-8")
    write_markdown(grid, curve, meta, md_path)

    print(f"\n{len(grid)} backtests in {meta['elapsedSeconds']}s")
    print(f"  {json_path}")
    print(f"  {md_path}")


if __name__ == "__main__":
    asyncio.run(main())
