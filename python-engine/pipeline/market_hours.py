"""
NSE market hours and holiday calendar.
Used by the pipeline to decide when to connect/disconnect the WebSocket.

NSE sessions (IST):
    Pre-open:   09:00 - 09:15
    Normal:     09:15 - 15:30
    Closing:    15:30 - 15:40
    Post-close: 15:40 - 16:00 (order matching, no new orders)

For tick capture, we stream from 09:00 through 15:40 to catch
pre-open auction and closing session data.
"""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

# Tick capture window — wider than normal trading hours
STREAM_START = time(9, 0)    # Pre-open session start
STREAM_END = time(15, 40)    # Closing session end

# Normal market hours (for reference / UI display)
MARKET_OPEN = time(9, 15)
MARKET_CLOSE = time(15, 30)

# NSE holidays 2026 — update annually from NSE circular.
NSE_HOLIDAYS_2026: set[date] = {
    date(2026, 1, 26),   # Republic Day
    date(2026, 3, 10),   # Maha Shivaratri
    date(2026, 3, 17),   # Holi
    date(2026, 3, 30),   # Id-Ul-Fitr (Ramzan Eid)
    date(2026, 4, 2),    # Ram Navami
    date(2026, 4, 3),    # Good Friday / Mahavir Jayanti
    date(2026, 4, 14),   # Dr. Ambedkar Jayanti
    date(2026, 5, 1),    # May Day / Maharashtra Day
    date(2026, 6, 5),    # Id-Ul-Adha (Bakri Eid)
    date(2026, 7, 6),    # Muharram
    date(2026, 8, 15),   # Independence Day
    date(2026, 8, 17),   # Janmashtami
    date(2026, 9, 4),    # Milad-un-Nabi
    date(2026, 10, 2),   # Mahatma Gandhi Jayanti
    date(2026, 10, 20),  # Dussehra
    date(2026, 11, 9),   # Diwali (Laxmi Pujan)
    date(2026, 11, 10),  # Diwali (Balipratipada)
    date(2026, 11, 24),  # Guru Nanak Jayanti
    date(2026, 12, 25),  # Christmas
}


def now_ist() -> datetime:
    return datetime.now(IST)


def is_trading_day(d: date | None = None) -> bool:
    if d is None:
        d = now_ist().date()
    if d.weekday() >= 5:  # Saturday / Sunday
        return False
    return d not in NSE_HOLIDAYS_2026


def is_stream_window() -> bool:
    """True if we should be streaming ticks (9:00 - 15:40 on trading days)."""
    now = now_ist()
    if not is_trading_day(now.date()):
        return False
    return STREAM_START <= now.time() <= STREAM_END


def is_market_open() -> bool:
    """True during normal trading hours (9:15 - 15:30)."""
    now = now_ist()
    if not is_trading_day(now.date()):
        return False
    return MARKET_OPEN <= now.time() <= MARKET_CLOSE


def seconds_until_stream_start() -> float:
    """Seconds until next stream window opens. Returns 0 if currently in window."""
    now = now_ist()
    if is_stream_window():
        return 0.0

    target = now.date()
    # If past today's window or not a trading day, find the next one
    if now.time() > STREAM_END or not is_trading_day(target):
        target = _next_trading_day(target)
    elif now.time() < STREAM_START and is_trading_day(target):
        pass  # Same day, just wait for 9:00
    else:
        target = _next_trading_day(target)

    open_dt = datetime.combine(target, STREAM_START, tzinfo=IST)
    return max((open_dt - now).total_seconds(), 0.0)


def seconds_until_stream_end() -> float:
    """Seconds until today's stream window closes. Returns 0 if already closed."""
    now = now_ist()
    if not is_stream_window():
        return 0.0
    close_dt = datetime.combine(now.date(), STREAM_END, tzinfo=IST)
    return max((close_dt - now).total_seconds(), 0.0)


def _next_trading_day(d: date) -> date:
    d = d + timedelta(days=1)
    while d.weekday() >= 5 or d in NSE_HOLIDAYS_2026:
        d += timedelta(days=1)
    return d
