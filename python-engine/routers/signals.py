"""
Signals Router — Unified Chart Data
====================================
Serves OHLCV + computed signals from TimescaleDB for chart widgets.
Rewritten from server/src/routes/signals.js.
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from services.db import get_pool

router = APIRouter()


def _parse_date(value: Optional[str], field: str) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field} must be a valid YYYY-MM-DD date.")


@router.get("/api/signals/unified/{ticker}")
async def unified_chart_data(
    ticker: str,
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=5000),
):
    bare_ticker = ticker.upper()
    pg_ticker = f"{bare_ticker}.NS"

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
            detail=f"No PostgreSQL data for {bare_ticker}. Run the ingestion pipeline.",
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

    return {
        "ticker": bare_ticker,
        "count": len(data),
        "requestedRange": {"startDate": startDate, "endDate": endDate},
        "actualRange": {
            "startDate": data[0]["time"] if data else None,
            "endDate": data[-1]["time"] if data else None,
        },
        "truncated": limit is not None,
        "data": data,
    }
