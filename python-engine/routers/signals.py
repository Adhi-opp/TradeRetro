"""
Signals Router — Unified Chart Data
====================================
Serves OHLCV + computed signals from TimescaleDB for chart widgets.

The endpoint computes strategy-specific indicators on-the-fly when
strategyType + params are passed, so the Price Chart tab in the UI
can render meaningful overlays for any strategy (not just the
SMAs pre-baked in analytics.daily_signals).
"""

from datetime import date
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException, Query

from engine.indicators import (
    compute_bollinger_bands,
    compute_donchian_channel,
    compute_macd,
    compute_rsi,
    compute_sma,
)
from services.db import get_pool
from services.ticker_resolver import normalize

router = APIRouter()


def _parse_date(value: Optional[str], field: str) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field} must be a valid YYYY-MM-DD date.")


def _attach_indicators(
    data: list[dict],
    strategy_type: Optional[str],
    fast_sma: Optional[int],
    slow_sma: Optional[int],
    rsi_period: Optional[int],
    bb_period: Optional[int],
    bb_std_dev: Optional[float],
    dc_period: Optional[int],
) -> dict:
    """
    Mutate `data` in-place, attaching indicator fields based on strategy.
    Returns a metadata dict describing what was attached, so the frontend
    can render the right overlays/subplots.
    """
    if not data or not strategy_type:
        return {"attached": []}

    closes = np.array([row["close"] for row in data], dtype=float)
    highs = np.array([row["high"] for row in data], dtype=float)
    lows = np.array([row["low"] for row in data], dtype=float)
    n = len(data)
    attached: list[str] = []

    if strategy_type == "MOVING_AVERAGE_CROSSOVER" and fast_sma and slow_sma:
        # On-the-fly SMA for arbitrary periods (warehouse only has 20/50/200)
        for period in (fast_sma, slow_sma):
            key = f"sma_{period}"
            if any(row.get(key) is not None for row in data):
                attached.append(key)
                continue
            if n >= period:
                sma_arr = compute_sma(closes, period)
                offset = period - 1
                for i, val in enumerate(sma_arr):
                    data[offset + i][key] = float(val)
            attached.append(key)

    elif strategy_type == "RSI" and rsi_period:
        if n > rsi_period:
            rsi_arr = compute_rsi(closes, rsi_period)
            # rsi_arr starts at index (rsi_period + 1) — first deltas[period:]
            offset = rsi_period + 1
            for i, val in enumerate(rsi_arr):
                if offset + i < n:
                    data[offset + i]["rsi"] = float(val)
        attached.append("rsi")

    elif strategy_type == "MACD":
        macd_results = compute_macd(closes)  # default 12/26/9
        offset = 26 - 1
        for i, result in enumerate(macd_results):
            if offset + i < n:
                data[offset + i]["macd"] = result["MACD"]
                data[offset + i]["macd_signal"] = result["signal"]
                data[offset + i]["macd_hist"] = result["histogram"]
        attached.extend(["macd", "macd_signal", "macd_hist"])

    elif strategy_type == "BOLLINGER_BREAKOUT":
        period = bb_period or 20
        std_dev = bb_std_dev or 2.0
        if n >= period:
            bb_results = compute_bollinger_bands(closes, period, std_dev)
            offset = period - 1
            for i, result in enumerate(bb_results):
                if offset + i < n:
                    data[offset + i]["bb_upper"] = result["upper"]
                    data[offset + i]["bb_middle"] = result["middle"]
                    data[offset + i]["bb_lower"] = result["lower"]
        attached.extend(["bb_upper", "bb_middle", "bb_lower"])

    elif strategy_type == "DONCHIAN_BREAKOUT":
        period = dc_period or 20
        if n > period:
            # compute_donchian_channel returns a full-length array (one entry
            # per bar, None during warm-up), so index it directly by bar.
            dc_results = compute_donchian_channel(highs, lows, period)
            for i, result in enumerate(dc_results):
                data[i]["donchian_high"] = result["highest_high"]
                data[i]["donchian_low"] = result["lowest_low"]
                data[i]["donchian_mid"] = result["mid"]
        attached.extend(["donchian_high", "donchian_low", "donchian_mid"])

    return {"attached": attached, "strategy_type": strategy_type}


@router.get("/api/signals/unified/{ticker}")
async def unified_chart_data(
    ticker: str,
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=5000),
    strategyType: Optional[str] = Query(None, description="Strategy whose indicators to compute"),
    fastSma: Optional[int] = Query(None, ge=2, le=500),
    slowSma: Optional[int] = Query(None, ge=2, le=500),
    rsiPeriod: Optional[int] = Query(None, ge=2, le=200),
    bbPeriod: Optional[int] = Query(None, ge=5, le=200),
    bbStdDev: Optional[float] = Query(None, ge=0.5, le=5.0),
    dcPeriod: Optional[int] = Query(None, ge=5, le=200),
):
    try:
        pg_ticker = normalize(ticker)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    start_date_obj = _parse_date(startDate, "startDate")
    end_date_obj = _parse_date(endDate, "endDate")

    filters = ["r.ticker = $1"]
    params: list = [pg_ticker]

    if start_date_obj:
        params.append(start_date_obj)
        filters.append(f"r.trade_date >= ${len(params)}")

    if end_date_obj:
        params.append(end_date_obj)
        filters.append(f"r.trade_date <= ${len(params)}")

    where_clause = " AND ".join(filters)

    base_query = f"""
        SELECT
            r.trade_date,
            r.open_price AS open,
            r.high_price AS high,
            r.low_price AS low,
            r.close_price AS close,
            r.volume,
            a.sma_20,
            a.sma_50,
            a.sma_200,
            a.daily_return_pct
        FROM raw.historical_prices r
        LEFT JOIN analytics.daily_signals a
            ON r.ticker = a.ticker AND r.trade_date = a.trade_date
        WHERE {where_clause}
    """

    if limit is not None:
        params.append(limit)
        query = f"""
            SELECT * FROM (
                {base_query}
                ORDER BY r.trade_date DESC
                LIMIT ${len(params)}
            ) AS limited_rows
            ORDER BY trade_date ASC;
        """
    else:
        query = f"{base_query} ORDER BY r.trade_date ASC;"

    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No PostgreSQL data for {pg_ticker}. Run the ingestion pipeline.",
        )

    data = []
    for row in rows:
        data.append({
            "time": row["trade_date"].isoformat(),
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": int(row["volume"]),
            "sma_20": float(row["sma_20"]) if row["sma_20"] is not None else None,
            "sma_50": float(row["sma_50"]) if row["sma_50"] is not None else None,
            "sma_200": float(row["sma_200"]) if row["sma_200"] is not None else None,
        })

    indicator_meta = _attach_indicators(
        data,
        strategy_type=strategyType,
        fast_sma=fastSma,
        slow_sma=slowSma,
        rsi_period=rsiPeriod,
        bb_period=bbPeriod,
        bb_std_dev=bbStdDev,
        dc_period=dcPeriod,
    )

    return {
        "ticker": pg_ticker,
        "count": len(data),
        "requestedRange": {"startDate": startDate, "endDate": endDate},
        "actualRange": {
            "startDate": data[0]["time"] if data else None,
            "endDate": data[-1]["time"] if data else None,
        },
        "truncated": limit is not None,
        "indicators": indicator_meta,
        "data": data,
    }
