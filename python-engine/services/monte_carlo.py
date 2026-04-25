"""
Parallel Monte Carlo Simulation
================================
Uses ProcessPoolExecutor for true multi-core parallelism.

Key optimization: data is fetched ONCE from PostgreSQL, then
a copy is passed to each worker process — no N database round-trips.
"""

import time
import statistics
from concurrent.futures import ProcessPoolExecutor
from multiprocessing import cpu_count

from engine.simulation import SimulationEngine


def _run_single_backtest(args: tuple) -> dict:
    market_data, initial_capital, strategy_config, seed, *rest = args
    visible_start_index = rest[0] if rest else 0

    config = {**strategy_config}
    config["params"] = {**config.get("params", {}), "seed": seed}

    engine = SimulationEngine(market_data, initial_capital, config, visible_start_index=visible_start_index)
    result = engine.run()

    return {
        "seed": seed,
        "totalReturn": result["metrics"]["totalReturn"],
        "maxDrawdown": result["metrics"]["maxDrawdown"],
        "winRate": result["metrics"]["winRate"],
        "sharpeRatio": result["metrics"]["sharpeRatio"],
        "totalTrades": result["metrics"]["totalTrades"],
        "cagr": result["metrics"]["cagr"],
        "alpha": result["metrics"]["alpha"],
    }


def run_monte_carlo(
    market_data: list[dict],
    initial_capital: float,
    strategy_config: dict,
    runs: int = 30,
    visible_start_index: int = 0,
) -> dict:
    start_time = time.time()

    worker_args = [
        (market_data, initial_capital, strategy_config, 1000 + i, visible_start_index)
        for i in range(runs)
    ]

    max_workers = min(cpu_count() or 4, runs)

    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        results = list(executor.map(_run_single_backtest, worker_args))

    returns = [r["totalReturn"] for r in results]
    drawdowns = [r["maxDrawdown"] for r in results]
    sorted_returns = sorted(returns)

    def percentile(data, p):
        k = (len(data) - 1) * (p / 100)
        f = int(k)
        c = f + 1 if f + 1 < len(data) else f
        d = k - f
        return data[f] + d * (data[c] - data[f])

    positive_runs = sum(1 for r in returns if r > 0)
    elapsed_ms = (time.time() - start_time) * 1000

    return {
        "distribution": {
            "mean": statistics.mean(returns),
            "median": statistics.median(returns),
            "stdDev": statistics.stdev(returns) if len(returns) > 1 else 0,
            "min": min(returns),
            "max": max(returns),
            "percentile5": percentile(sorted_returns, 5),
            "percentile25": percentile(sorted_returns, 25),
            "percentile75": percentile(sorted_returns, 75),
            "percentile95": percentile(sorted_returns, 95),
            "positiveRuns": positive_runs,
            "totalRuns": runs,
        },
        "runs": results,
        "executionTimeMs": round(elapsed_ms, 1),
    }
