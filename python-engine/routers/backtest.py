"""
Backtest Router
===============
POST /api/backtest — run a single strategy backtest
POST /api/monte-carlo — run Monte Carlo simulation
"""

import asyncio
import time

from fastapi import APIRouter, HTTPException

from engine.simulation import SimulationEngine
from models.requests import BacktestRequest, MonteCarloRequest
from models.responses import BacktestResponse, MonteCarloResponse
from services.data_loader import (
    HistoricalDataWindow,
    InsufficientWarmupHistoryError,
    InvalidDateError,
    NoDataError,
    load_historical_data,
)
from services.monte_carlo import run_monte_carlo

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


@router.post("/api/monte-carlo")
async def monte_carlo(req: MonteCarloRequest):
    start_time = time.time()
    window = await _load_window(req)
    _ensure_strategy_has_data(req, window)
    market_data = _dataframe_to_market_data(window)

    strategy_config = {"strategyType": req.strategyType, "params": req.params}

    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            run_monte_carlo,
            market_data,
            req.params["initialCapital"],
            strategy_config,
            req.runs,
            window.visible_start_index,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=_error_body("MONTE_CARLO_ERROR", f"Monte Carlo error: {exc}"),
        ) from exc

    metadata = result.get("metadata") or {}
    metadata.update(_build_metadata(start_time, window, req))
    metadata["executionTimeMs"] = result.get("executionTimeMs", metadata["executionTimeMs"])
    result["metadata"] = metadata

    try:
        MonteCarloResponse.model_validate(result)
    except Exception as validation_err:
        raise HTTPException(
            status_code=500,
            detail=_error_body("RESPONSE_CONTRACT_VIOLATION", f"Monte Carlo output failed schema validation: {validation_err}"),
        ) from validation_err

    return result
