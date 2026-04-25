"""
Strategy Signal Evaluators
==========================
Port of evaluateMovingAverageCrossover, evaluateRSI, evaluateMACD
from SimulationEngine.js:198-241.

Each function returns 'BUY', 'SELL', or 'HOLD'.
"""


def evaluate_ma_crossover(indicators: dict, index: int) -> str:
    """
    Moving Average Crossover — golden cross / death cross detection.

    Uses <= / >= for crossover detection (not strict < / >),
    matching the JS implementation exactly.
    """
    short_sma = indicators["shortSMA"]
    long_sma = indicators["longSMA"]
    short_offset = indicators["shortOffset"]
    long_offset = indicators["longOffset"]

    if index < long_offset:
        return "HOLD"

    si = index - short_offset
    li = index - long_offset

    current_short = short_sma[si] if 0 <= si < len(short_sma) else None
    current_long = long_sma[li] if 0 <= li < len(long_sma) else None
    prev_short = short_sma[si - 1] if 0 <= si - 1 < len(short_sma) else None
    prev_long = long_sma[li - 1] if 0 <= li - 1 < len(long_sma) else None

    if any(v is None for v in (current_short, current_long, prev_short, prev_long)):
        return "HOLD"

    # Golden cross: short crosses above long
    if prev_short <= prev_long and current_short > current_long:
        return "BUY"

    # Death cross: short crosses below long
    if prev_short >= prev_long and current_short < current_long:
        return "SELL"

    return "HOLD"


def evaluate_rsi(indicators: dict, index: int, oversold: float, overbought: float) -> str:
    """
    RSI threshold strategy.
    Buy when RSI drops below oversold, sell when above overbought.
    """
    rsi = indicators["rsi"]
    rsi_offset = indicators["rsiOffset"]

    rsi_idx = index - rsi_offset
    if rsi_idx < 0 or rsi_idx >= len(rsi):
        return "HOLD"

    rsi_val = rsi[rsi_idx]
    if rsi_val is None:
        return "HOLD"

    if rsi_val < oversold:
        return "BUY"
    if rsi_val > overbought:
        return "SELL"

    return "HOLD"


def evaluate_macd(indicators: dict, index: int) -> str:
    """
    MACD histogram crossover strategy.
    Buy when histogram crosses above zero, sell when below.
    """
    macd = indicators["macd"]
    macd_offset = indicators["macdOffset"]

    macd_idx = index - macd_offset
    if macd_idx < 1:
        return "HOLD"

    current = macd[macd_idx]
    prev = macd[macd_idx - 1]

    if (not current or not prev or
            current.get("MACD") is None or current.get("signal") is None or
            prev.get("MACD") is None or prev.get("signal") is None):
        return "HOLD"

    current_hist = current["MACD"] - current["signal"]
    prev_hist = prev["MACD"] - prev["signal"]

    if prev_hist <= 0 and current_hist > 0:
        return "BUY"
    if prev_hist >= 0 and current_hist < 0:
        return "SELL"

    return "HOLD"


def evaluate_bollinger_breakout(indicators: dict, index: int) -> str:
    """
    Bollinger Bands Breakout Strategy.
    Buy when price breaks above upper band, sell when breaks below lower band.
    """
    bb = indicators["bb"]
    bb_offset = indicators["bbOffset"]

    bb_idx = index - bb_offset
    if bb_idx < 1 or bb_idx >= len(bb):
        return "HOLD"

    current = bb[bb_idx]
    prev = bb[bb_idx - 1]

    if (not current or not prev or
            current.get("upper") is None or current.get("lower") is None or
            prev.get("upper") is None or prev.get("lower") is None or
            current.get("close") is None or prev.get("close") is None):
        return "HOLD"

    # Buy: price crosses above upper band
    if prev["close"] <= prev["upper"] and current["close"] > current["upper"]:
        return "BUY"

    # Sell: price crosses below lower band
    if prev["close"] >= prev["lower"] and current["close"] < current["lower"]:
        return "SELL"

    return "HOLD"


def evaluate_orb(indicators: dict, index: int, orb_minutes: int = 30) -> str:
    """
    Opening Range Breakout (ORB) Strategy.
    For daily data, approximates by checking if current candle breaks
    above/below the first candle's high/low.
    
    Returns BUY if price > first candle high, SELL if < first candle low.
    """
    ohlc = indicators["ohlc"]
    if not ohlc or len(ohlc) < 2:
        return "HOLD"

    # For daily strategy: first candle sets opening range
    first_candle = ohlc[0]
    current_candle = ohlc[index] if index < len(ohlc) else None

    if not current_candle:
        return "HOLD"

    # ORB breakout logic
    if current_candle["high"] > first_candle["high"]:
        return "BUY"
    if current_candle["low"] < first_candle["low"]:
        return "SELL"

    return "HOLD"


def evaluate_vwap_reversion(indicators: dict, index: int, reversion_pct: float = 0.01) -> str:
    """
    VWAP Mean Reversion Strategy.
    Buy when price is 1% below VWAP, sell when 1% above VWAP.
    """
    vwap = indicators["vwap"]
    close = indicators["close"]

    if index < 0 or index >= len(vwap) or index >= len(close):
        return "HOLD"

    current_price = close[index]
    current_vwap = vwap[index]

    if current_vwap is None or current_price is None:
        return "HOLD"

    # Buy: price significantly below VWAP
    if current_price < current_vwap * (1.0 - reversion_pct):
        return "BUY"

    # Sell: price significantly above VWAP
    if current_price > current_vwap * (1.0 + reversion_pct):
        return "SELL"

    return "HOLD"


def evaluate_donchian_breakout(indicators: dict, index: int) -> str:
    """
    Donchian Channel Breakout Strategy.
    Buy when price closes above highest high, sell when below lowest low.
    """
    donchian = indicators["donchian"]
    close = indicators["close"]

    if index < 0 or index >= len(donchian) or index >= len(close):
        return "HOLD"

    current = donchian[index]
    current_price = close[index]

    if (not current or current.get("highest_high") is None or
            current.get("lowest_low") is None or current_price is None):
        return "HOLD"

    # Buy: price closes above highest high
    if current_price > current["highest_high"]:
        return "BUY"

    # Sell: price closes below lowest low
    if current_price < current["lowest_low"]:
        return "SELL"

    return "HOLD"
