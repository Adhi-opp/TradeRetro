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
