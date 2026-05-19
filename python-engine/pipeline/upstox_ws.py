"""
Upstox WebSocket Producer — connects to the Upstox V3 market data feed,
decodes protobuf ticks, and pushes them to the `market:ticks` Redis Stream.

Flow:
    1. Poll Redis for access token (set via /api/auth/login or /api/auth/token)
    2. Get authorized V3 WebSocket URL from Upstox
    3. Connect, subscribe to instruments
    4. Stream ticks → Redis until stream window closes
    5. Sleep until next stream window, repeat

Scope: equities + indices + India VIX only. Options/microstructure
analytics belong to GammaLeak, not TradeRetro — see
[[feedback-traderetro-vs-gammaleak]] in memory.
"""

import asyncio
import json
import logging
from datetime import datetime

import websockets

from services.redis_client import xadd_tick
from services.upstox_client import upstox_auth
from pipeline.market_hours import (
    is_stream_window, seconds_until_stream_start, IST,
)

logger = logging.getLogger("traderetro.ws_producer")

# Default instruments to subscribe to (Nifty 50 large-caps + indices + India VIX).
# Instrument keys follow Upstox V3 conventions (NSE_INDEX|<name>, NSE_EQ|<ISIN>).
# India VIX was added in V3 — see Upstox Market Data Feed V3 docs.
DEFAULT_INSTRUMENTS = [
    "NSE_EQ|INE009A01021",   # RELIANCE
    "NSE_EQ|INE002A01018",   # SBIN
    "NSE_EQ|INE090A01021",   # ICICIBANK
    "NSE_EQ|INE040A01034",   # HDFCBANK
    "NSE_EQ|INE669E01016",   # TCS
    "NSE_EQ|INE154A01025",   # ITC
    "NSE_EQ|INE118H01025",   # BHARTIARTL
    "NSE_EQ|INE028A01039",   # BAJFINANCE
    "NSE_EQ|INE860A01027",   # HCLTECH
    "NSE_EQ|INE467B01029",   # INFY
    "NSE_INDEX|Nifty 50",    # NIFTY 50 index
    "NSE_INDEX|Nifty Bank",  # BANK NIFTY index
    "NSE_INDEX|India VIX",   # India VIX (V3-only instrument)
]

SYMBOL_MAP = {
    "NSE_EQ|INE009A01021": "RELIANCE",
    "NSE_EQ|INE002A01018": "SBIN",
    "NSE_EQ|INE090A01021": "ICICIBANK",
    "NSE_EQ|INE040A01034": "HDFCBANK",
    "NSE_EQ|INE669E01016": "TCS",
    "NSE_EQ|INE154A01025": "ITC",
    "NSE_EQ|INE118H01025": "BHARTIARTL",
    "NSE_EQ|INE028A01039": "BAJFINANCE",
    "NSE_EQ|INE860A01027": "HCLTECH",
    "NSE_EQ|INE467B01029": "INFY",
    "NSE_INDEX|Nifty 50": "NIFTY50",
    "NSE_INDEX|Nifty Bank": "BANKNIFTY",
    "NSE_INDEX|India VIX": "INDIAVIX",
}


def _ltpc_timestamp(ltpc) -> str:
    """Prefer exchange tick time when present, otherwise use local receive time."""
    if getattr(ltpc, "ltt", 0):
        return datetime.fromtimestamp(ltpc.ltt / 1000, IST).isoformat()
    return datetime.now(IST).isoformat()


def _make_tick(inst_key: str, ltpc, ext_vol=0, ext_oi=0, bid_ask=None) -> dict:
    """Build a Redis-shaped tick dict from V3 protobuf fields."""
    timestamp = _ltpc_timestamp(ltpc)
    return {
        b"instrument_key": inst_key.encode(),
        b"symbol": SYMBOL_MAP.get(inst_key, inst_key).encode(),
        b"ltp": str(ltpc.ltp).encode(),
        b"volume": str(int(ext_vol)).encode(),
        b"oi": str(int(ext_oi)).encode(),
        b"bid_price": str(bid_ask.bidP if bid_ask else 0).encode(),
        b"ask_price": str(bid_ask.askP if bid_ask else 0).encode(),
        b"bid_qty": str(int(bid_ask.bidQ) if bid_ask else 0).encode(),
        b"ask_qty": str(int(bid_ask.askQ) if bid_ask else 0).encode(),
        b"timestamp": timestamp.encode(),
        b"source": b"upstox",
    }


def decode_protobuf_tick(binary_data: bytes) -> list[dict]:
    """
    Decode Upstox V3 protobuf FeedResponse into tick dicts for Redis.

    V3 structure (vs V2):
      FeedResponse { type, feeds<map>, currentTs, marketInfo }
      Feed { oneof { ltpc | fullFeed | firstLevelWithGreeks } }
      FullFeed { oneof { marketFF | indexFF } }

    Falls back gracefully if the compiled proto module isn't available.
    """
    try:
        from proto import MarketDataFeed_pb2

        feed_response = MarketDataFeed_pb2.FeedResponse()
        feed_response.ParseFromString(binary_data)

        # market_info (type=2) carries segment status, not ticks. Skip.
        if feed_response.type == 2:
            return []

        ticks = []
        for inst_key, feed in feed_response.feeds.items():
            which = feed.WhichOneof("FeedUnion")

            if which == "ltpc":
                # Pure LTPC-mode subscription
                ticks.append(_make_tick(inst_key, feed.ltpc))

            elif which == "fullFeed":
                full = feed.fullFeed
                inner = full.WhichOneof("FullFeedUnion")

                if inner == "marketFF":
                    mf = full.marketFF
                    if not mf.ltpc.ltp:
                        continue
                    bid_ask = mf.marketLevel.bidAskQuote[0] if mf.marketLevel.bidAskQuote else None
                    ticks.append(_make_tick(
                        inst_key, mf.ltpc,
                        ext_vol=mf.vtt, ext_oi=mf.oi, bid_ask=bid_ask,
                    ))
                elif inner == "indexFF":
                    ixf = full.indexFF
                    if not ixf.ltpc.ltp:
                        continue
                    ticks.append(_make_tick(inst_key, ixf.ltpc))

            elif which == "firstLevelWithGreeks":
                flwg = feed.firstLevelWithGreeks
                if not flwg.ltpc.ltp:
                    continue
                bid_ask = flwg.firstDepth.bidAskQuote if flwg.firstDepth else None
                ticks.append(_make_tick(
                    inst_key, flwg.ltpc,
                    ext_vol=flwg.vtt, ext_oi=flwg.oi, bid_ask=bid_ask,
                ))

        return ticks

    except ImportError:
        logger.error(
            "Proto module not available — run: protoc -I=proto --python_out=proto proto/MarketDataFeed.proto"
        )
        return []
    except Exception as exc:
        logger.error(f"Protobuf decode error: {exc}")
        return []


async def _wait_for_token(poll_interval: float = 10.0) -> str:
    """Block until an access token is available in Redis."""
    logger.info("Waiting for Upstox access token (authenticate via /api/auth/login)...")
    while True:
        token = await upstox_auth.get_access_token()
        if token:
            logger.info("Access token found")
            return token
        await asyncio.sleep(poll_interval)


async def _subscribe(ws, instrument_keys: list[str]) -> None:
    """Send subscription request over the WebSocket."""
    msg = json.dumps({
        "guid": "traderetro-sub-1",
        "method": "sub",
        "data": {
            "mode": "full",
            "instrumentKeys": instrument_keys,
        },
    })
    await ws.send(msg.encode("utf-8"))
    logger.info(f"Subscribed to {len(instrument_keys)} instruments")


async def produce(instrument_keys: list[str] | None = None) -> None:
    """
    Main producer loop. Runs indefinitely:
        - Waits for token
        - Waits for stream window (9:00 - 15:40 IST on trading days)
        - Connects to Upstox V3 WebSocket
        - Streams ticks to Redis
        - Disconnects at stream end, sleeps until next window
    """
    instruments = list(instrument_keys or DEFAULT_INSTRUMENTS)
    tick_count = 0

    while True:
        # Step 1: ensure we have a valid token
        await _wait_for_token()

        # Step 2: wait for stream window
        wait = seconds_until_stream_start()
        if wait > 0:
            logger.info(f"Outside stream window — sleeping {wait:.0f}s until next open")
            while wait > 0:
                await asyncio.sleep(min(wait, 300))
                wait = seconds_until_stream_start()
            continue

        # Step 3: connect and stream
        try:
            ws_url = await upstox_auth.get_ws_url()
            logger.info("Connecting to Upstox V3 WebSocket...")

            async with websockets.connect(ws_url, ping_interval=30) as ws:
                await _subscribe(ws, instruments)
                session_ticks = 0
                msg_count = 0

                async for message in ws:
                    msg_count += 1

                    # First-N-message diagnostics so we can tell whether we're
                    # getting any traffic at all from V3 (and what shape).
                    if msg_count <= 5:
                        if isinstance(message, bytes):
                            logger.info(
                                "WS msg #%d: %d bytes binary, first 32 bytes hex=%s",
                                msg_count, len(message), message[:32].hex(),
                            )
                        else:
                            logger.info(
                                "WS msg #%d: text/json: %s",
                                msg_count, str(message)[:200],
                            )
                    elif msg_count % 500 == 0:
                        logger.info(
                            "WS msgs received: %d (binary=%s, ticks parsed so far=%d)",
                            msg_count, isinstance(message, bytes), session_ticks,
                        )

                    if not is_stream_window():
                        logger.info(f"Stream window closed — session ticks: {session_ticks}")
                        break

                    if isinstance(message, bytes):
                        ticks = decode_protobuf_tick(message)
                        if msg_count <= 5:
                            logger.info("WS msg #%d decoded into %d ticks", msg_count, len(ticks))
                    else:
                        logger.info(f"WS non-binary msg #{msg_count}: {str(message)[:200]}")
                        continue

                    for tick in ticks:
                        await xadd_tick(tick)
                        tick_count += 1
                        session_ticks += 1

                    if session_ticks > 0 and session_ticks % 500 == 0:
                        logger.info(f"Session: {session_ticks} ticks | Total: {tick_count}")

        except websockets.ConnectionClosed as exc:
            logger.warning(f"WebSocket closed ({exc.code}): {exc.reason}. Reconnecting in 5s...")
            await asyncio.sleep(5)

        except Exception as exc:
            logger.error(f"Producer error: {exc}. Retrying in 10s...")
            await asyncio.sleep(10)
