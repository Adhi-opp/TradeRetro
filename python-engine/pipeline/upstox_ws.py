"""
Upstox WebSocket Producer — connects to Upstox market data feed,
decodes ticks, and pushes them to Redis Streams.

The Upstox v2 WebSocket sends binary protobuf-encoded FeedResponse messages.
This module decodes them into flat dicts and publishes to the `market:ticks`
Redis Stream in the same format as the simulator.

Prerequisites:
    1. Complete OAuth via /api/auth/login → /api/auth/callback
    2. Protobuf schema compiled (see proto/MarketDataFeed.proto)
"""

import asyncio
import json
import logging
import struct
from datetime import datetime
from zoneinfo import ZoneInfo

import websockets

from services.redis_client import xadd_tick
from services.upstox_client import upstox_auth
from pipeline.market_hours import is_market_open, seconds_until_market_open, IST

logger = logging.getLogger("traderetro.ws_producer")

# Default instruments to subscribe to (Nifty 50 large-caps)
DEFAULT_INSTRUMENTS = [
    "NSE_EQ|INE009A01021",  # RELIANCE
    "NSE_EQ|INE002A01018",  # SBIN
    "NSE_EQ|INE090A01021",  # ICICIBANK
    "NSE_EQ|INE040A01034",  # HDFCBANK
    "NSE_EQ|INE669E01016",  # TCS
    "NSE_EQ|INE154A01025",  # ITC
    "NSE_EQ|INE118H01025",  # BHARTIARTL
    "NSE_EQ|INE028A01039",  # BAJFINANCE
    "NSE_INDEX|Nifty 50",   # NIFTY 50 index
    "NSE_INDEX|Nifty Bank",  # BANK NIFTY index
]

# Instrument key → human-readable symbol mapping
SYMBOL_MAP = {
    "NSE_EQ|INE009A01021": "RELIANCE",
    "NSE_EQ|INE002A01018": "SBIN",
    "NSE_EQ|INE090A01021": "ICICIBANK",
    "NSE_EQ|INE040A01034": "HDFCBANK",
    "NSE_EQ|INE669E01016": "TCS",
    "NSE_EQ|INE154A01025": "ITC",
    "NSE_EQ|INE118H01025": "BHARTIARTL",
    "NSE_EQ|INE028A01039": "BAJFINANCE",
    "NSE_INDEX|Nifty 50": "NIFTY50",
    "NSE_INDEX|Nifty Bank": "BANKNIFTY",
}


def decode_protobuf_tick(binary_data: bytes) -> list[dict]:
    """
    Decode Upstox protobuf FeedResponse into a list of tick dicts.

    The Upstox WebSocket sends binary protobuf messages. The FeedResponse
    contains a map of instrument_key → Feed, where each Feed has LTPC
    (last traded price/close), market level (bid/ask), and OHLC data.

    Returns a list of flat tick dicts ready for Redis XADD.
    """
    try:
        from proto import MarketDataFeed_pb2

        feed_response = MarketDataFeed_pb2.FeedResponse()
        feed_response.ParseFromString(binary_data)

        ticks = []
        now = datetime.now(IST).isoformat()

        for inst_key, feed in feed_response.feeds.items():
            ff = feed.ff  # FullFeed
            if not ff or not ff.marketFF:
                continue

            mf = ff.marketFF
            ltpc = mf.ltpc
            bid_ask = mf.marketLevel.bidAskQuote[0] if mf.marketLevel.bidAskQuote else None
            ext = mf.eFeedDetails

            tick = {
                "instrument_key": inst_key.encode(),
                "symbol": SYMBOL_MAP.get(inst_key, inst_key).encode(),
                "ltp": str(ltpc.ltp).encode(),
                "volume": str(int(ext.vol) if ext else 0).encode(),
                "oi": str(int(ext.oi) if ext else 0).encode(),
                "bid_price": str(bid_ask.bp if bid_ask else 0).encode(),
                "ask_price": str(bid_ask.ap if bid_ask else 0).encode(),
                "bid_qty": str(int(bid_ask.bq) if bid_ask else 0).encode(),
                "ask_qty": str(int(bid_ask.aq) if bid_ask else 0).encode(),
                "timestamp": now.encode(),
                "source": b"upstox",
            }
            ticks.append(tick)

        return ticks

    except ImportError:
        logger.warning(
            "Protobuf module not compiled — run: protoc -I=proto --python_out=proto proto/MarketDataFeed.proto"
        )
        return []
    except Exception as exc:
        logger.error(f"Protobuf decode error: {exc}")
        return []


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
    Main producer loop.
    Connects to Upstox WebSocket, decodes ticks, pushes to Redis.
    Reconnects on disconnection. Pauses outside market hours.
    """
    instruments = instrument_keys or DEFAULT_INSTRUMENTS
    tick_count = 0

    while True:
        # Wait for market hours
        wait = seconds_until_market_open()
        if wait > 0:
            logger.info(f"Market closed — sleeping {wait:.0f}s until next open")
            await asyncio.sleep(min(wait, 300))  # Re-check every 5 min
            continue

        try:
            ws_url = await upstox_auth.get_ws_url()
            logger.info("Connecting to Upstox WebSocket...")

            async with websockets.connect(ws_url) as ws:
                await _subscribe(ws, instruments)

                async for message in ws:
                    if not is_market_open():
                        logger.info("Market closed — disconnecting")
                        break

                    ticks = decode_protobuf_tick(message)
                    for tick in ticks:
                        await xadd_tick(tick)
                        tick_count += 1

                    if tick_count % 500 == 0 and tick_count > 0:
                        logger.info(f"Producer: {tick_count} ticks pushed to Redis")

        except websockets.ConnectionClosed as exc:
            logger.warning(f"WebSocket closed: {exc}. Reconnecting in 5s...")
            await asyncio.sleep(5)
        except Exception as exc:
            logger.error(f"Producer error: {exc}. Retrying in 10s...")
            await asyncio.sleep(10)
