"""
NSE market hours and holiday calendar.
Used by the pipeline to decide when to connect/disconnect the WebSocket.
"""

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

MARKET_OPEN = time(9, 15)
MARKET_CLOSE = time(15, 30)
PRE_OPEN_START = time(9, 0)

# NSE holidays 2026 — update annually from NSE circular.
# Source: typical NSE holiday schedule (verify against official list).
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


def is_market_open() -> bool:
    now = now_ist()
    if not is_trading_day(now.date()):
        return False
    return MARKET_OPEN <= now.time() <= MARKET_CLOSE


def seconds_until_market_open() -> float:
    """Seconds until next market open. Returns 0 if market is currently open."""
    now = now_ist()
    if is_market_open():
        return 0.0

    # Walk forward day-by-day to find the next trading day
    target = now.date()
    for _ in range(10):
        if now.time() > MARKET_CLOSE or not is_trading_day(target):
            target = _next_weekday(target)
        if is_trading_day(target):
            break
        target = _next_weekday(target)

    market_open_dt = datetime.combine(target, MARKET_OPEN, tzinfo=IST)
    delta = (market_open_dt - now).total_seconds()
    return max(delta, 0.0)


def seconds_until_market_close() -> float:
    """Seconds until today's market close. Returns 0 if market is already closed."""
    now = now_ist()
    if not is_market_open():
        return 0.0
    close_dt = datetime.combine(now.date(), MARKET_CLOSE, tzinfo=IST)
    return max((close_dt - now).total_seconds(), 0.0)


def _next_weekday(d: date) -> date:
    from datetime import timedelta
    d = d + timedelta(days=1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d
