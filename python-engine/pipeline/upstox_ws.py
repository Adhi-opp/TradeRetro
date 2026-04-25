"""
Upstox WebSocket Producer — connects to Upstox market data feed,
decodes ticks, and pushes them to Redis Streams.

The Upstox v2 WebSocket sends binary protobuf-encoded FeedResponse messages.
This module decodes them into flat dicts and publishes to the `market:ticks`
Redis Stream in the same format as the simulator.

Flow:
    1. Poll Redis for access token (set via /api/auth/login or /api/auth/token)
    2. Get authorized WebSocket URL from Upstox
    3. Connect, subscribe to instruments
    4. Stream ticks → Redis until market closes
    5. Sleep until next stream window, repeat
"""

import asyncio
import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

import websockets

from services.redis_client import xadd_tick
from services.upstox_client import upstox_auth
from pipeline.market_hours import (
    is_stream_window, seconds_until_stream_start, seconds_until_stream_end, IST,
)

logger = logging.getLogger("traderetro.ws_producer")

# Default instruments to subscribe to (Nifty 50 large-caps + indices)
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
}


def decode_protobuf_tick(binary_data: bytes) -> list[dict]:
    """
    Decode Upstox protobuf FeedResponse into tick dicts for Redis.

    Falls back gracefully if the compiled proto module isn't available.
    """
    try:
        from proto import MarketDataFeed_pb2

        feed_response = MarketDataFeed_pb2.FeedResponse()
        feed_response.ParseFromString(binary_data)

        ticks = []
        now = datetime.now(IST).isoformat()

        for inst_key, feed in feed_response.feeds.items():
            ff = feed.ff
            if not ff:
                continue

            # Market feed (equities)
            mf = ff.marketFF
            # Index feed
            ixf = ff.indexFF

            if mf and mf.ltpc:
                ltpc = mf.ltpc
                bid_ask = mf.marketLevel.bidAskQuote[0] if mf.marketLevel.bidAskQuote else None
                ext = mf.eFeedDetails

                ticks.append({
                    b"instrument_key": inst_key.encode(),
                    b"symbol": SYMBOL_MAP.get(inst_key, inst_key).encode(),
                    b"ltp": str(ltpc.ltp).encode(),
                    b"volume": str(int(ext.vol) if ext else 0).encode(),
                    b"oi": str(int(ext.oi) if ext else 0).encode(),
                    b"bid_price": str(bid_ask.bp if bid_ask else 0).encode(),
                    b"ask_price": str(bid_ask.ap if bid_ask else 0).encode(),
                    b"bid_qty": str(int(bid_ask.bq) if bid_ask else 0).encode(),
                    b"ask_qty": str(int(bid_ask.aq) if bid_ask else 0).encode(),
                    b"timestamp": now.encode(),
                    b"source": b"upstox",
                })

            elif ixf and ixf.ltpc:
                ltpc = ixf.ltpc
                ticks.append({
                    b"instrument_key": inst_key.encode(),
                    b"symbol": SYMBOL_MAP.get(inst_key, inst_key).encode(),
                    b"ltp": str(ltpc.ltp).encode(),
                    b"volume": b"0",
                    b"oi": b"0",
                    b"bid_price": b"0",
                    b"ask_price": b"0",
                    b"bid_qty": b"0",
                    b"ask_qty": b"0",
                    b"timestamp": now.encode(),
                    b"source": b"upstox",
                })

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
        - Connects to Upstox WebSocket
        - Streams ticks to Redis
        - Disconnects at stream end, sleeps until next window
    """
    instruments = instrument_keys or DEFAULT_INSTRUMENTS
    tick_count = 0

    while True:
        # Step 1: Ensure we have a valid token
        await _wait_for_token()

        # Step 2: Wait for stream window
        wait = seconds_until_stream_start()
        if wait > 0:
            # Sleep in chunks of 5 min so we can re-check token validity
            logger.info(f"Outside stream window — sleeping {wait:.0f}s until next open")
            while wait > 0:
                await asyncio.sleep(min(wait, 300))
                wait = seconds_until_stream_start()
            continue

        # Step 3: Connect and stream
        try:
            ws_url = await upstox_auth.get_ws_url()
            logger.info(f"Connecting to Upstox WebSocket...")

            async with websockets.connect(ws_url, ping_interval=30) as ws:
                await _subscribe(ws, instruments)
                session_ticks = 0

                async for message in ws:
                    if not is_stream_window():
                        logger.info(f"Stream window closed — session ticks: {session_ticks}")
                        break

                    if isinstance(message, bytes):
                        ticks = decode_protobuf_tick(message)
                    else:
                        logger.debug(f"Non-binary message: {message[:100]}")
                        continue

                    for tick in ticks:
                        await xadd_tick(tick)
                        tick_count += 1
                        session_ticks += 1

                    if session_ticks % 500 == 0 and session_ticks > 0:
                        logger.info(
                            f"Session: {session_ticks} ticks | Total: {tick_count}"
                        )

        except websockets.ConnectionClosed as exc:
            logger.warning(f"WebSocket closed ({exc.code}): {exc.reason}. Reconnecting in 5s...")
            await asyncio.sleep(5)

        except Exception as exc:
            logger.error(f"Producer error: {exc}. Retrying in 10s...")
            await asyncio.sleep(10)
