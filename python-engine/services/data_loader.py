"""
PostgreSQL Data Loader (asyncpg pool)
=====================================
Refactored to use the shared connection pool instead of per-request connects.
"""

from dataclasses import dataclass
from datetime import date
from typing import Optional

import pandas as pd

from services.db import get_pool


class InvalidDateError(ValueError):
    pass


class NoDataError(ValueError):
    pass


class InsufficientWarmupHistoryError(ValueError):
    def __init__(
        self,
        ticker: str,
        required_warmup_candles: int,
        available_warmup_candles: int,
        earliest_available_date: date,
        requested_start_date: date,
    ):
        self.ticker = ticker
        self.required_warmup_candles = required_warmup_candles
        self.available_warmup_candles = available_warmup_candles
        self.earliest_available_date = earliest_available_date
        self.requested_start_date = requested_start_date
        super().__init__(
            f"{ticker} needs {required_warmup_candles} warm-up candles before {requested_start_date.isoformat()}, "
            f"but PostgreSQL only has {available_warmup_candles} candles starting at {earliest_available_date.isoformat()}."
        )

    def details(self) -> dict:
        return {
            "ticker": self.ticker,
            "requiredWarmupCandles": self.required_warmup_candles,
            "availableWarmupCandles": self.available_warmup_candles,
            "earliestAvailableDate": self.earliest_available_date.isoformat(),
            "requestedStartDate": self.requested_start_date.isoformat(),
        }


@dataclass(frozen=True)
class HistoricalDataWindow:
    frame: pd.DataFrame
    visible_start_index: int
    requested_start_date: Optional[date]
    requested_end_date: Optional[date]

    @property
    def visible_frame(self) -> pd.DataFrame:
        return self.frame.iloc[self.visible_start_index:].reset_index(drop=True)

    @property
    def visible_count(self) -> int:
        return len(self.frame) - self.visible_start_index

    @property
    def buffered_count(self) -> int:
        return self.visible_start_index

    @property
    def earliest_available_date(self) -> date:
        return self.frame.iloc[0]["date"].date()

    @property
    def latest_available_date(self) -> date:
        return self.frame.iloc[-1]["date"].date()


def _parse_optional_date(value: Optional[str], field_name: str) -> Optional[date]:
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise InvalidDateError(f"{field_name} must be a valid YYYY-MM-DD date.") from exc


async def load_historical_data(
    ticker: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    warmup_candles: int = 0,
) -> HistoricalDataWindow:
    pg_ticker = ticker if ticker.endswith(".NS") else f"{ticker}.NS"
    start_date_obj = _parse_optional_date(start_date, "startDate")
    end_date_obj = _parse_optional_date(end_date, "endDate")

    if start_date_obj and end_date_obj and start_date_obj > end_date_obj:
        raise InvalidDateError("startDate must be before or equal to endDate.")

    query = """
        SELECT
            r.trade_date AS date,
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
        WHERE r.ticker = $1
    """

    params: list[object] = [pg_ticker]

    if end_date_obj:
        query += f" AND r.trade_date <= ${len(params) + 1}"
        params.append(end_date_obj)

    query += " ORDER BY r.trade_date ASC;"

    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)

    if not rows:
        raise NoDataError(f"No data found for ticker '{pg_ticker}' in PostgreSQL.")

    df = pd.DataFrame([dict(row) for row in rows])

    float_cols = ["open", "high", "low", "close", "sma_20", "sma_50", "sma_200", "daily_return_pct"]
    for col in float_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").astype(float)

    df["date"] = pd.to_datetime(df["date"])

    visible_start_index = 0
    if start_date_obj:
        visible_rows = df.index[df["date"] >= pd.Timestamp(start_date_obj)]
        if len(visible_rows) == 0:
            raise NoDataError(
                f"No data found for ticker '{pg_ticker}' in PostgreSQL for the requested range "
                f"{start_date_obj.isoformat()} -> {end_date_obj.isoformat() if end_date_obj else 'latest'}."
            )

        visible_start_index = int(visible_rows[0])

        if warmup_candles > 0 and visible_start_index < warmup_candles:
            raise InsufficientWarmupHistoryError(
                ticker=pg_ticker,
                required_warmup_candles=warmup_candles,
                available_warmup_candles=visible_start_index,
                earliest_available_date=df.iloc[0]["date"].date(),
                requested_start_date=start_date_obj,
            )

    window = HistoricalDataWindow(
        frame=df.reset_index(drop=True),
        visible_start_index=visible_start_index,
        requested_start_date=start_date_obj,
        requested_end_date=end_date_obj,
    )

    if window.visible_count <= 0:
        raise NoDataError(f"No visible data found for ticker '{pg_ticker}' in PostgreSQL.")

    return window
