"""
Pydantic Request Models
=======================
Port of STRATEGY_SCHEMAS and validateBacktest() from server/src/index.js:68-250.
"""

import re
from typing import Optional, Literal

from pydantic import BaseModel, field_validator, model_validator


STRATEGY_TYPES = Literal[
    "MOVING_AVERAGE_CROSSOVER",
    "RSI",
    "MACD",
    "BOLLINGER_BREAKOUT",
    "DONCHIAN_BREAKOUT",
]


class BacktestRequest(BaseModel):
    """
    Backtest request payload — matches the POST /api/backtest body.

    Supports the 5 daily-timeframe strategies wired up in
    engine/simulation.py. (Intraday-only strategies — ORB, session-VWAP
    reversion — were removed: they are statistically meaningless on daily
    EOD bars and belong in a separate intraday engine.)
    """
    symbol: str
    strategyType: STRATEGY_TYPES
    params: dict
    startDate: Optional[str] = None
    endDate: Optional[str] = None

    @field_validator("symbol")
    @classmethod
    def validate_symbol(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^[A-Za-z0-9.\-^]{1,20}$", v):
            raise ValueError("symbol must be 1-20 characters (A-Z, 0-9, . - ^)")
        return v.upper()

    @model_validator(mode="after")
    def validate_strategy_params(self):
        """Per-strategy param validation + cross-param rules."""
        p = self.params
        st = self.strategyType

        # Always required: initialCapital
        ic = p.get("initialCapital")
        if ic is None:
            raise ValueError("params.initialCapital is required")
        if not isinstance(ic, (int, float)) or ic < 100 or ic > 1e8:
            raise ValueError("initialCapital must be between 100 and 100,000,000")

        # Optional risk model — applies to every strategy. riskPct and
        # stopLossPct must be supplied together (one without the other is
        # ambiguous: risk sizing needs a stop to define the risk).
        risk = p.get("riskPct")
        stop = p.get("stopLossPct")
        if (risk is None) != (stop is None):
            raise ValueError("riskPct and stopLossPct must be provided together")
        if risk is not None:
            if not isinstance(risk, (int, float)) or risk <= 0 or risk > 0.5:
                raise ValueError("riskPct must be between 0 (exclusive) and 0.5")
            if not isinstance(stop, (int, float)) or stop <= 0 or stop > 0.5:
                raise ValueError("stopLossPct must be between 0 (exclusive) and 0.5")

        if st == "MOVING_AVERAGE_CROSSOVER":
            sp = p.get("shortPeriod")
            lp = p.get("longPeriod")
            if sp is None:
                raise ValueError("params.shortPeriod is required")
            if not isinstance(sp, int) or sp < 2 or sp > 200:
                raise ValueError("shortPeriod must be an integer between 2 and 200")
            if lp is None:
                raise ValueError("params.longPeriod is required")
            if not isinstance(lp, int) or lp < 5 or lp > 500:
                raise ValueError("longPeriod must be an integer between 5 and 500")
            if sp >= lp:
                raise ValueError("shortPeriod must be strictly less than longPeriod")
            if (lp - sp) < 5:
                raise ValueError("longPeriod must be at least 5 greater than shortPeriod")

        elif st == "RSI":
            rp = p.get("rsiPeriod")
            os_ = p.get("oversold")
            ob = p.get("overbought")
            if rp is None:
                raise ValueError("params.rsiPeriod is required")
            if not isinstance(rp, int) or rp < 2 or rp > 200:
                raise ValueError("rsiPeriod must be an integer between 2 and 200")
            if os_ is None:
                raise ValueError("params.oversold is required")
            if not isinstance(os_, (int, float)) or os_ < 1 or os_ > 49:
                raise ValueError("oversold must be between 1 and 49")
            if ob is None:
                raise ValueError("params.overbought is required")
            if not isinstance(ob, (int, float)) or ob < 51 or ob > 99:
                raise ValueError("overbought must be between 51 and 99")
            if os_ >= ob:
                raise ValueError("oversold must be strictly less than overbought")

        elif st == "MACD":
            pass  # no extra required params

        elif st == "BOLLINGER_BREAKOUT":
            bp = p.get("bbPeriod")
            bs = p.get("bbStdDev")
            if bp is None:
                raise ValueError("params.bbPeriod is required")
            if not isinstance(bp, int) or bp < 5 or bp > 200:
                raise ValueError("bbPeriod must be an integer between 5 and 200")
            if bs is None:
                raise ValueError("params.bbStdDev is required")
            if not isinstance(bs, (int, float)) or bs < 0.5 or bs > 5.0:
                raise ValueError("bbStdDev must be between 0.5 and 5.0")

        elif st == "DONCHIAN_BREAKOUT":
            dp = p.get("dcPeriod")
            if dp is None:
                raise ValueError("params.dcPeriod is required")
            if not isinstance(dp, int) or dp < 5 or dp > 200:
                raise ValueError("dcPeriod must be an integer between 5 and 200")

        return self

    def min_candles(self) -> int:
        """Minimum candles required for the selected strategy."""
        st = self.strategyType
        p = self.params
        if st == "MOVING_AVERAGE_CROSSOVER":
            return p["longPeriod"]
        if st == "RSI":
            return p["rsiPeriod"] + 1
        if st == "MACD":
            return 35
        if st == "BOLLINGER_BREAKOUT":
            return p["bbPeriod"]
        if st == "DONCHIAN_BREAKOUT":
            # +1: the channel uses the prior N bars (shift(1)), so the first
            # breakout can only be evaluated on bar N+1.
            return p["dcPeriod"] + 1
        return 0
