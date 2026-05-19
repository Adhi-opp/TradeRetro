"""
Backtest Router
===============
POST /api/backtest        — run a single strategy backtest
POST /api/backtest/sweep  — parameter sweep, returns 2D metric grid
"""

import asyncio
import time
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from engine.simulation import SimulationEngine
from models.requests import BacktestRequest
from models.responses import BacktestResponse
from services.data_loader import (
    HistoricalDataWindow,
    InsufficientWarmupHistoryError,
    InvalidDateError,
    NoDataError,
    load_historical_data,
)

router = APIRouter()


def _error_body(error: str, message: str, details=None) -> dict:
    body = {"error": error, "message": message}
    if details is not None:
        body["details"] = details
    return body


def _warmup_candles_for_request(req: BacktestRequest) -> int:
    return req.min_candles() if req.startDate else 0


async def _load_window(req: BacktestRequest) -> HistoricalDataWindow:
    warmup_candles = _warmup_candles_for_request(req)
    try:
        return await load_historical_data(
            ticker=req.symbol,
            start_date=req.startDate,
            end_date=req.endDate,
            warmup_candles=warmup_candles,
        )
    except InvalidDateError as exc:
        raise HTTPException(status_code=400, detail=_error_body("VALIDATION_ERROR", str(exc))) from exc
    except NoDataError as exc:
        raise HTTPException(status_code=404, detail=_error_body("NO_DATA", str(exc))) from exc
    except InsufficientWarmupHistoryError as exc:
        raise HTTPException(
            status_code=422,
            detail=_error_body("INSUFFICIENT_WARMUP_HISTORY", str(exc), exc.details()),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=_error_body("POSTGRES_UNAVAILABLE", f"PostgreSQL unavailable: {exc}"),
        ) from exc


def _ensure_strategy_has_data(req: BacktestRequest, window: HistoricalDataWindow):
    min_candles = req.min_candles()
    if window.visible_start_index == 0 and len(window.frame) < min_candles:
        raise HTTPException(
            status_code=422,
            detail=_error_body(
                "INSUFFICIENT_DATA",
                f"Strategy needs >= {min_candles} candles but PostgreSQL only has {len(window.frame)} total candles.",
            ),
        )


def _dataframe_to_market_data(window: HistoricalDataWindow) -> list[dict]:
    market_data = []
    for _, row in window.frame.iterrows():
        market_data.append({
            "date": row["date"].isoformat() if hasattr(row["date"], "isoformat") else str(row["date"]),
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": int(row["volume"]) if row["volume"] else 0,
        })
    return market_data


def _build_metadata(start_time: float, window: HistoricalDataWindow, req: BacktestRequest) -> dict:
    return {
        "executionTimeMs": round((time.time() - start_time) * 1000, 1),
        "dataPoints": window.visible_count,
        "bufferedDataPoints": window.buffered_count,
        "warmupCandlesRequested": _warmup_candles_for_request(req),
        "warmupCandlesAvailable": window.buffered_count,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        "executionEngine": "python",
        "dataSource": "timescaledb_medallion",
    }


@router.post("/api/backtest")
async def backtest(req: BacktestRequest):
    start_time = time.time()
    window = await _load_window(req)
    _ensure_strategy_has_data(req, window)
    market_data = _dataframe_to_market_data(window)

    strategy_config = {"strategyType": req.strategyType, "params": req.params}

    try:
        engine = SimulationEngine(
            market_data,
            req.params["initialCapital"],
            strategy_config,
            visible_start_index=window.visible_start_index,
        )
        result = engine.run()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_body("BACKTEST_EXECUTION_ERROR", f"Backtest execution error: {exc}"),
        ) from exc

    result["metadata"] = _build_metadata(start_time, window, req)

    try:
        BacktestResponse.model_validate(result)
    except Exception as validation_err:
        raise HTTPException(
            status_code=500,
            detail=_error_body("RESPONSE_CONTRACT_VIOLATION", f"Engine output failed schema validation: {validation_err}"),
        ) from validation_err

    return result


# ── Parameter Sweep ──────────────────────────────────────────────

class SweepRequest(BaseModel):
    symbol: str
    strategyType: Literal["MOVING_AVERAGE_CROSSOVER", "RSI", "MACD"]
    baseParams: dict = Field(..., description="Strategy params held constant (must include initialCapital)")
    startDate: str
    endDate: str
    paramA: str = Field(..., description="Name of first param to vary, e.g. 'shortPeriod'")
    valuesA: list[float] = Field(..., min_length=2, max_length=15)
    paramB: str = Field(..., description="Name of second param to vary, e.g. 'longPeriod'")
    valuesB: list[float] = Field(..., min_length=2, max_length=15)
    metric: Literal["sharpe", "totalReturn", "maxDrawdown", "calmar"] = "sharpe"


def _safe_metric_extract(result: dict, metric: str) -> Optional[float]:
    """Pull a metric from the engine result, return None if missing or NaN."""
    metrics = result.get("metrics") or {}
    key_map = {
        "sharpe": "sharpeRatio",
        "totalReturn": "totalReturn",
        "maxDrawdown": "maxDrawdown",
        "calmar": None,  # not in engine output — computed from CAGR / |maxDD|
    }
    if metric == "calmar":
        cagr = metrics.get("cagr")
        mdd = metrics.get("maxDrawdown")
        if cagr is None or mdd is None or mdd == 0:
            return None
        try:
            return float(cagr) / abs(float(mdd))
        except (TypeError, ValueError, ZeroDivisionError):
            return None
    v = metrics.get(key_map[metric])
    if v is None:
        return None
    try:
        f = float(v)
        if f != f:  # NaN
            return None
        return f
    except (TypeError, ValueError):
        return None


def _run_one_cell(
    market_data: list[dict],
    strategy_type: str,
    base_params: dict,
    param_a: str,
    value_a: float,
    param_b: str,
    value_b: float,
    visible_start_index: int,
) -> dict:
    """One cell of the sweep grid — runs the engine, returns key metrics."""
    params = {**base_params}
    # Coerce ints for known integer params
    int_params = {"shortPeriod", "longPeriod", "rsiPeriod"}
    params[param_a] = int(value_a) if param_a in int_params else value_a
    params[param_b] = int(value_b) if param_b in int_params else value_b

    try:
        engine = SimulationEngine(
            market_data,
            params["initialCapital"],
            {"strategyType": strategy_type, "params": params},
            visible_start_index=visible_start_index,
        )
        result = engine.run()
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

    m = result.get("metrics") or {}
    return {
        "ok": True,
        "sharpe": _safe_metric_extract(result, "sharpe"),
        "totalReturn": _safe_metric_extract(result, "totalReturn"),
        "maxDrawdown": _safe_metric_extract(result, "maxDrawdown"),
        "calmar": _safe_metric_extract(result, "calmar"),
        "trades": int(m.get("totalTrades", 0)),
    }


@router.post("/api/backtest/sweep")
async def parameter_sweep(req: SweepRequest):
    """
    Run the strategy across a 2D grid of parameter values. Loads OHLCV
    once, then runs the engine N×M times. Returns the grid plus the
    best cell by the requested metric for the "sweet spot" callout.

    Heavy compute — cap is 15×15 = 225 cells. Typical 5×5 grid takes
    ~5-15s. Frontend shows a spinner during the request.
    """
    start_time = time.time()

    if "initialCapital" not in req.baseParams:
        raise HTTPException(
            status_code=400,
            detail=_error_body("VALIDATION_ERROR", "baseParams.initialCapital is required"),
        )
    if req.paramA == req.paramB:
        raise HTTPException(
            status_code=400,
            detail=_error_body("VALIDATION_ERROR", "paramA and paramB must be different"),
        )

    # Build a faux BacktestRequest just for data-window sizing
    max_a = max(int(v) if isinstance(v, (int, float)) else 0 for v in req.valuesA)
    max_b = max(int(v) if isinstance(v, (int, float)) else 0 for v in req.valuesB)
    warmup_params = {**req.baseParams, req.paramA: max_a, req.paramB: max_b}
    try:
        faux_req = BacktestRequest(
            symbol=req.symbol,
            strategyType=req.strategyType,
            params=warmup_params,
            startDate=req.startDate,
            endDate=req.endDate,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=_error_body("VALIDATION_ERROR", f"Sweep param combinations failed validation: {exc}"),
        ) from exc

    window = await _load_window(faux_req)
    market_data = _dataframe_to_market_data(window)

    # Run the grid sequentially in a thread executor — numpy/pandas releases
    # the GIL during heavy ops so this gives some parallelism for free.
    loop = asyncio.get_running_loop()

    async def run_cell(va, vb):
        return await loop.run_in_executor(
            None,
            _run_one_cell,
            market_data, req.strategyType, req.baseParams,
            req.paramA, va, req.paramB, vb,
            window.visible_start_index,
        )

    tasks = []
    for va in req.valuesA:
        for vb in req.valuesB:
            tasks.append(run_cell(va, vb))
    flat_results = await asyncio.gather(*tasks)

    # Reshape into [len(valuesA)][len(valuesB)]
    grid: list[list[dict]] = []
    idx = 0
    best = None
    for va in req.valuesA:
        row = []
        for vb in req.valuesB:
            cell = flat_results[idx]
            cell["paramA"] = va
            cell["paramB"] = vb
            row.append(cell)
            # Track best by chosen metric (higher = better, except for maxDrawdown where higher = closer to 0 = better)
            metric_value = cell.get(req.metric)
            if cell.get("ok") and metric_value is not None:
                if best is None or metric_value > best[req.metric]:
                    best = cell
            idx += 1
        grid.append(row)

    return {
        "axes": {
            "paramA": {"name": req.paramA, "values": req.valuesA},
            "paramB": {"name": req.paramB, "values": req.valuesB},
        },
        "metric": req.metric,
        "grid": grid,
        "best": best,
        "cellCount": len(req.valuesA) * len(req.valuesB),
        "executionTimeMs": round((time.time() - start_time) * 1000, 1),
    }
