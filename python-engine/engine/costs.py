"""
Indian Equity Transaction Cost Model + Seeded PRNG
===================================================
Faithful port of SimulationEngine.js:21-76.

The seeded RNG replicates JavaScript's 32-bit integer arithmetic exactly,
including Math.imul behavior, so identical seeds produce identical slippage.
"""

import math
import ctypes

# ── Indian Transaction Cost Constants ─────────────────────────────────────────
# Mirror of INDIA_EQUITY_COSTS from SimulationEngine.js:21-31

INDIA_EQUITY_COSTS = {
    "stt_delivery_buy":  0.001,      # 0.1% STT on buy (delivery)
    "stt_delivery_sell": 0.001,      # 0.1% STT on sell (delivery)
    "brokerage":         0.0003,     # 0.03% flat brokerage (discount broker)
    "exchange_txn":      0.0000345,  # NSE transaction charge
    "gst":               0.18,       # 18% GST on brokerage + exchange charges
    "sebi_fee":          0.000001,   # SEBI turnover fee
    "stamp_duty_buy":    0.00015,    # 0.015% stamp duty on buy
    "slippage_mean":     0.001,      # 0.1% average slippage
    "slippage_std":      0.0005,     # slippage variability
}


def _imul32(a: int, b: int) -> int:
    """
    Replicate JavaScript's Math.imul: signed 32-bit integer multiplication.
    JS truncates to signed int32 after multiply.
    """
    return ctypes.c_int32(a * b).value


def _to_uint32(x: int) -> int:
    """Replicate JavaScript's >>> 0 (unsigned right shift by 0)."""
    return x & 0xFFFFFFFF


def _to_int32(x: int) -> int:
    """Replicate JavaScript's | 0 (bitwise OR with 0 → signed int32)."""
    return ctypes.c_int32(x).value


def create_seeded_rng(seed: int):
    """
    Port of createSeededRng from SimulationEngine.js:68-76.

    XORShift32-based PRNG that produces identical output to the JS version
    when given the same seed.
    """
    s = [_to_int32(seed)]

    def rng() -> float:
        s[0] = _to_int32(s[0] + 0x6D2B79F5)
        t = _imul32(s[0] ^ _to_uint32(s[0]) >> 15, _to_int32(1 | s[0]))
        t = _to_int32(t + _to_int32(_imul32(_to_int32(t ^ _to_uint32(t) >> 7), _to_int32(61 | t))))
        t = _to_int32(t ^ (_to_uint32(t) >> 14))
        return _to_uint32(t) / 4294967296

    return rng


def calculate_indian_costs(trade_value: float, side: str, rng=None) -> dict:
    """
    Port of calculateIndianCosts from SimulationEngine.js:33-65.

    Args:
        trade_value: Total trade value in INR (shares × price)
        side: 'BUY' or 'SELL'
        rng: Seeded RNG function for stochastic slippage

    Returns:
        dict with individual cost components and total
    """
    c = INDIA_EQUITY_COSTS

    stt = 0.0
    stamp_duty = 0.0

    if side == "BUY":
        stt = trade_value * c["stt_delivery_buy"]
        stamp_duty = trade_value * c["stamp_duty_buy"]
    else:
        stt = trade_value * c["stt_delivery_sell"]

    brokerage = trade_value * c["brokerage"]
    exchange_txn = trade_value * c["exchange_txn"]
    gst = (brokerage + exchange_txn) * c["gst"]
    sebi_fee = trade_value * c["sebi_fee"]

    # Slippage: Box-Muller transform for normal distribution
    slippage = 0.0
    if rng is not None:
        u1 = rng()
        u2 = rng()
        z = math.sqrt(-2 * math.log(u1 or 0.0001)) * math.cos(2 * math.pi * u2)
        slippage = abs(z * c["slippage_std"] + c["slippage_mean"]) * trade_value
    else:
        slippage = c["slippage_mean"] * trade_value

    total = stt + brokerage + exchange_txn + gst + sebi_fee + stamp_duty + slippage

    return {
        "stt": stt,
        "brokerage": brokerage,
        "exchangeTxn": exchange_txn,
        "gst": gst,
        "sebiFee": sebi_fee,
        "stampDuty": stamp_duty,
        "slippage": slippage,
        "total": total,
    }
