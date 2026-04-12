import argparse
import logging
import os
from datetime import date, datetime, timedelta
from typing import Any, Generator, Optional, Sequence

from src.ingestion.quality import run_quality_checks

logger = logging.getLogger("traderetro.ingestion")

DEFAULT_PERIOD = "10y"
YAHOO_INDEX_MAP = {
    "NIFTY50.NS": "^NSEI",
    "BANKNIFTY.NS": "^NSEBANK",
} 

def get_watermark(ticker: str) -> str | None:
    """
    Checks the ops.data_catalog to find the most recent data we have.
    Returns a date string (YYYY-MM-DD) or None if the ticker is brand new.
    """
    # Use the existing helper function so we don't need to import psycopg2 manually
    conn = _get_connection()
    
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT high_watermark FROM ops.data_catalog WHERE ticker = %s;", 
                    (ticker,)
                )
                result = cur.fetchone()
                
                if result and result[0]:
                    # Return the date as a string
                    return result[0].strftime('%Y-%m-%d')
                return None
    finally:
        conn.close()

def _require_market_data_dependencies():
    try:
        import pandas as pd
        import yfinance as yf
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Missing market data dependency. Install python-quant-engine/requirements.txt before running ingestion."
        ) from exc
    return pd, yf


def _default_yfinance_cache_dir() -> str:
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    return os.path.join(project_root, ".yfinance-cache")


def _configure_yfinance_cache(yf):
    cache_dir = os.getenv("YFINANCE_TZ_CACHE_DIR", _default_yfinance_cache_dir())
    os.makedirs(cache_dir, exist_ok=True)
    yf.set_tz_cache_location(cache_dir)


def _require_postgres_dependencies():
    try:
        import psycopg2
        from psycopg2.extras import execute_batch
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Missing PostgreSQL dependency. Install python-quant-engine/requirements.txt before running ingestion."
        ) from exc
    return psycopg2, execute_batch


def stream_ohlcv(
    ticker: str,
    start: Optional[str] = None,
    end: Optional[str] = None,
    period: Optional[str] = None,
) -> Generator[dict, None, None]:
    pd, yf = _require_market_data_dependencies()
    _configure_yfinance_cache(yf)
    yf_symbol = YAHOO_INDEX_MAP.get(ticker, ticker)
    fetch_kwargs: dict[str, object] = {
        "progress": False,
        "auto_adjust": True,
    }

    if start or end:
        if start:
            fetch_kwargs["start"] = start
        if end:
            fetch_kwargs["end"] = end
        window_label = f"{start or 'start'} -> {end or 'today'}"
    else:
        fetch_kwargs["period"] = period or DEFAULT_PERIOD
        window_label = f"period={fetch_kwargs['period']}"

    if yf_symbol != ticker:
        logger.info("Yahoo symbol remap: %s -> %s", ticker, yf_symbol)
    logger.info("Fetching %s (%s)...", ticker, window_label)
    df = yf.download(yf_symbol, **fetch_kwargs)

    if df is None or df.empty:
        logger.warning("No data returned for %s.", ticker)
        return

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    logger.info("Got %d rows for %s. Streaming...", len(df), ticker)
    for i in range(len(df)):
        yield {
            "date": str(df.index[i].date()),
            "open": round(float(df["Open"].iloc[i]), 2),
            "high": round(float(df["High"].iloc[i]), 2),
            "low": round(float(df["Low"].iloc[i]), 2),
            "close": round(float(df["Close"].iloc[i]), 2),
            "volume": int(df["Volume"].iloc[i]),
        }


def load_to_postgres(ticker: str, data_stream) -> tuple[int, int]:
    """Load OHLCV rows into raw.historical_prices.

    Returns (rows_fetched, rows_inserted). rows_inserted uses the DB row
    count after ON CONFLICT DO NOTHING to reflect actual new rows.
    """
    _, execute_batch = _require_postgres_dependencies()
    logger.info("Connecting to PostgreSQL for %s...", ticker)
    conn = _get_connection()

    insert_query = """
        INSERT INTO raw.historical_prices
        (ticker, trade_date, open_price, high_price, low_price, close_price, volume)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (ticker, trade_date) DO NOTHING;
    """

    tuple_rows = list(
        (ticker, row["date"], row["open"], row["high"], row["low"], row["close"], row["volume"])
        for row in data_stream
    )

    if not tuple_rows:
        logger.warning("No rows fetched for %s; skipping raw insert.", ticker)
        conn.close()
        return 0, 0

    try:
        with conn:
            with conn.cursor() as cur:
                # Count rows before insert to calculate actual inserts
                cur.execute(
                    "SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = %s",
                    (ticker,),
                )
                count_before = cur.fetchone()[0]

                logger.info("Batch inserting %s...", ticker)
                execute_batch(cur, insert_query, tuple_rows, page_size=1000)

                cur.execute(
                    "SELECT COUNT(*) FROM raw.historical_prices WHERE ticker = %s",
                    (ticker,),
                )
                count_after = cur.fetchone()[0]

        rows_inserted = count_after - count_before
        logger.info(
            "Raw load complete for %s (%d fetched, %d new rows inserted).",
            ticker, len(tuple_rows), rows_inserted,
        )
        return len(tuple_rows), rows_inserted
    except Exception as e:
        logger.error("Database Error for %s: %s", ticker, e)
        return 0, 0
    finally:
        conn.close()


def _get_connection():
    psycopg2, _ = _require_postgres_dependencies()
    return psycopg2.connect(
        dbname=os.getenv("PGDATABASE", "traderetro_raw"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD"),
        host=os.getenv("PGHOST", "localhost"),
        port=os.getenv("PGPORT", "5432"),
    )


def compute_and_store_signals(ticker: str) -> int:
    """Read OHLCV from raw layer, compute SMA 20/50/200 + daily return, upsert to analytics."""
    pd, _ = _require_market_data_dependencies()
    _, execute_batch = _require_postgres_dependencies()
    logger.info("Computing analytics signals for %s...", ticker)
    conn = _get_connection()

    try:
        # Read raw OHLCV
        df = pd.read_sql(
            "SELECT trade_date, close_price FROM raw.historical_prices "
            "WHERE ticker = %s ORDER BY trade_date ASC",
            conn,
            params=(ticker,),
        )

        if df.empty:
            logger.warning("No raw data for %s, skipping signal computation.", ticker)
            return 0

        # Compute indicators
        df["sma_20"] = df["close_price"].rolling(window=20).mean().round(2)
        df["sma_50"] = df["close_price"].rolling(window=50).mean().round(2)
        df["sma_200"] = df["close_price"].rolling(window=200).mean().round(2)
        df["daily_return_pct"] = (df["close_price"].pct_change() * 100).round(4)

        # Upsert rows (table created by migrations/002_create_analytics_schema.sql)
        upsert_query = """
            INSERT INTO analytics.daily_signals
                (ticker, trade_date, close_price, sma_20, sma_50, sma_200, daily_return_pct)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (ticker, trade_date) DO UPDATE SET
                close_price      = EXCLUDED.close_price,
                sma_20           = EXCLUDED.sma_20,
                sma_50           = EXCLUDED.sma_50,
                sma_200          = EXCLUDED.sma_200,
                daily_return_pct = EXCLUDED.daily_return_pct;
        """

        rows = []
        for _, r in df.iterrows():
            rows.append((
                ticker,
                r["trade_date"],
                float(r["close_price"]),
                None if pd.isna(r["sma_20"]) else float(r["sma_20"]),
                None if pd.isna(r["sma_50"]) else float(r["sma_50"]),
                None if pd.isna(r["sma_200"]) else float(r["sma_200"]),
                None if pd.isna(r["daily_return_pct"]) else float(r["daily_return_pct"]),
            ))

        with conn:
            with conn.cursor() as cur:
                execute_batch(cur, upsert_query, rows, page_size=1000)

        logger.info("%d signal rows upserted for %s.", len(rows), ticker)
        return len(rows)

    except Exception as e:
        logger.error("Signal computation error for %s: %s", ticker, e)
        return 0
    finally:
        conn.close()


def _split_tickers(values: Sequence[str]) -> list[str]:
    tickers = []
    for value in values:
        tickers.extend(part.strip().upper() for part in value.split(",") if part.strip())
    return tickers


def _default_tickers() -> list[str]:
    tickers = os.getenv("OHLCV_TICKERS")
    if tickers:
        return _split_tickers([tickers])
    return ["RELIANCE.NS", "TCS.NS"]


def _parse_iso_date(label: str, value: Optional[str]) -> Optional[str]:
    if value in (None, ""):
        return None

    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise ValueError(f"{label} must be a valid YYYY-MM-DD date.") from exc


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Backfill OHLCV data into PostgreSQL and recompute analytics.")
    parser.add_argument(
        "--symbol",
        dest="symbols",
        action="append",
        help="Ticker to ingest. Repeat the flag for multiple symbols or pass a comma-separated list.",
    )
    parser.add_argument("--start-date", help="Fetch window start date in YYYY-MM-DD format.")
    parser.add_argument("--end-date", help="Fetch window end date in YYYY-MM-DD format.")
    parser.add_argument("--period", help="yfinance period such as 1y, 5y, 10y, or max.")
    return parser


def _resolve_tickers(args: argparse.Namespace) -> list[str]:
    if args.symbols:
        tickers = _split_tickers(args.symbols)
    else:
        tickers = _default_tickers()

    if not tickers:
        raise ValueError("No tickers resolved. Supply --symbol or set OHLCV_TICKERS.")

    return tickers


def _resolve_fetch_mode(args: argparse.Namespace) -> dict[str, Any]:
    env_start = os.getenv("OHLCV_START_DATE")
    env_end = os.getenv("OHLCV_END_DATE")
    env_period = os.getenv("OHLCV_PERIOD")

    cli_dates_supplied = args.start_date is not None or args.end_date is not None
    cli_period_supplied = args.period is not None

    if cli_dates_supplied and cli_period_supplied:
        raise ValueError("Use either --period or --start-date/--end-date, not both.")

    explicit = cli_dates_supplied or cli_period_supplied

    if cli_dates_supplied:
        start_date = _parse_iso_date("start-date", args.start_date)
        end_date = _parse_iso_date("end-date", args.end_date)
        mode = "date_range"
        period = None
    elif cli_period_supplied:
        start_date = None
        end_date = None
        period = args.period.strip()
        mode = "period"
    elif env_start or env_end:
        start_date = _parse_iso_date("OHLCV_START_DATE", env_start)
        end_date = _parse_iso_date("OHLCV_END_DATE", env_end)
        period = None
        mode = "date_range"
    else:
        start_date = None
        end_date = None
        period = (env_period or DEFAULT_PERIOD).strip()
        mode = "period"

    if mode == "date_range" and start_date and end_date and start_date > end_date:
        raise ValueError("start-date must be before or equal to end-date.")

    if mode == "period" and not period:
        raise ValueError("period cannot be empty.")

    return {
        "mode": mode,
        "start_date": start_date,
        "end_date": end_date,
        "period": period,
        "explicit": explicit,
    }


def process_ticker(ticker: str, fetch_mode: dict[str, Any]) -> bool:
    # 1. Check for Manual Overrides vs. Watermark CDC
    # If the user explicitly passed CLI args (--start-date, --period, etc.), skip watermark
    watermark = get_watermark(ticker) if not fetch_mode.get("explicit") else None

    if watermark:
        # Incremental Load: Start from the day after the watermark
        next_day = (datetime.strptime(watermark, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
        actual_start = next_day
        actual_end = fetch_mode.get("end_date")
        actual_period = None
        load_type = "incremental"
        logger.info("CDC Watermark found for %s: %s. Incremental load from %s.", ticker, watermark, actual_start)
    else:
        # Full Load
        actual_start = fetch_mode.get("start_date")
        actual_end = fetch_mode.get("end_date")
        actual_period = fetch_mode.get("period")
        load_type = "full"

    # 2. Open Audit Log (Running State)
    conn = _get_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO ops.ingestion_log (ticker, load_type, status)
                    VALUES (%s, %s, 'running') RETURNING run_id;
                """, (ticker, load_type))
                run_id = cur.fetchone()[0]
    except Exception as e:
        logger.error("Failed to write to ops.ingestion_log: %s", e)
        return False
    finally:
        conn.close()

    error_msg = None
    rows_fetched = 0
    rows_inserted = 0
    signal_rows = 0
    status = 'failed'

    # 3. Execute Pipeline
    try:
        rows_fetched, rows_inserted = load_to_postgres(
            ticker,
            stream_ohlcv(
                ticker,
                start=actual_start,
                end=actual_end,
                period=actual_period,
            ),
        )

        if rows_fetched == 0 and load_type == "incremental":
            logger.info("%s is up to date. No new rows fetched.", ticker)
            status = 'success'
        elif rows_fetched == 0:
            logger.warning("No raw data fetched for %s.", ticker)
            error_msg = "No data fetched."
        else:
            # Data Quality Gate — validate before computing signals
            dq_conn = _get_connection()
            try:
                dq_result = run_quality_checks(
                    ticker, dq_conn,
                    only_recent=(load_type == "incremental"),
                )
            finally:
                dq_conn.close()

            if dq_result["hard_fail"]:
                error_msg = f"DQ hard fail: {dq_result['hard_failures']}"
                logger.error("Blocking signal compute for %s: %s", ticker, error_msg)
            else:
                signal_rows = compute_and_store_signals(ticker)
                if signal_rows > 0:
                    status = 'success'
                else:
                    error_msg = "Signal computation failed."

    except Exception as e:
        error_msg = str(e)
        logger.error("Error processing %s: %s", ticker, e)

    # 4. Close Audit Log & Update Watermark
    conn = _get_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                # Mark log as success/failed
                cur.execute("""
                    UPDATE ops.ingestion_log
                    SET finished_at = CURRENT_TIMESTAMP,
                        rows_fetched = %s,
                        rows_inserted = %s,
                        status = %s,
                        error_message = %s
                    WHERE run_id = %s;
                """, (rows_fetched, rows_inserted, status, error_msg, run_id))

                # If successful and we actually ingested data, advance the high watermark
                if status == 'success' and rows_fetched > 0:
                    cur.execute("""
                        INSERT INTO ops.data_catalog (ticker, first_trade_date, high_watermark, last_refreshed)
                        VALUES (
                            %s,
                            (SELECT MIN(trade_date) FROM raw.historical_prices WHERE ticker = %s),
                            (SELECT MAX(trade_date) FROM raw.historical_prices WHERE ticker = %s),
                            CURRENT_TIMESTAMP
                        )
                        ON CONFLICT (ticker) DO UPDATE SET
                            high_watermark = EXCLUDED.high_watermark,
                            last_refreshed = EXCLUDED.last_refreshed;
                    """, (ticker, ticker, ticker))
    except Exception as e:
        logger.error("Failed to update ops schema for %s: %s", ticker, e)
    finally:
        conn.close()

    if status == 'success':
        logger.info("%s CDC pipeline finished: fetched=%d, inserted=%d, signals=%d.", ticker, rows_fetched, rows_inserted, signal_rows)
        return True
    return False


def _configure_logging():
    """Set up structured JSON-ish logging for the pipeline."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )


def main(argv: Optional[Sequence[str]] = None) -> int:
    _configure_logging()
    parser = _build_parser()
    args = parser.parse_args(argv)

    try:
        tickers = _resolve_tickers(args)
        fetch_mode = _resolve_fetch_mode(args)
    except ValueError as exc:
        logger.error("%s", exc)
        return 1

    if fetch_mode["mode"] == "date_range":
        logger.info("Fetch mode: date_range (%s -> %s)", fetch_mode['start_date'] or 'start', fetch_mode['end_date'] or 'today')
    else:
        logger.info("Fetch mode: period (%s)", fetch_mode['period'])
    logger.info("Tickers: %s", ", ".join(tickers))

    failures = []
    for ticker in tickers:
        try:
            ok = process_ticker(ticker, fetch_mode)
        except RuntimeError as exc:
            logger.error("%s", exc)
            return 1

        if not ok:
            failures.append(ticker)

    if failures:
        logger.error("Completed with failures: %s", ", ".join(failures))
        return 1

    logger.info("All tickers finished successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
