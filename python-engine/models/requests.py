"""
Pydantic Request Models
=======================
Port of STRATEGY_SCHEMAS and validateBacktest() from server/src/index.js:68-250.
"""

import re
from typing import Optional, Literal

from pydantic import BaseModel, field_validator, model_validator


class BacktestRequest(BaseModel):
    """
    Backtest request payload — matches Express POST /api/backtest body.
    """
    symbol: str
    strategyType: Literal["MOVING_AVERAGE_CROSSOVER", "RSI", "MACD"]
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
        """Port of STRATEGY_SCHEMAS validation + cross-param rules."""
        p = self.params
        st = self.strategyType

        # Always required: initialCapital
        ic = p.get("initialCapital")
        if ic is None:
            raise ValueError("params.initialCapital is required")
        if not isinstance(ic, (int, float)) or ic < 100 or ic > 1e8:
            raise ValueError("initialCapital must be between 100 and 100,000,000")

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

            # Cross-param rules
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
            # MACD has no extra required params beyond initialCapital
            pass

        return self

    def min_candles(self) -> int:
        """Minimum candles required for the selected strategy."""
        if self.strategyType == "MOVING_AVERAGE_CROSSOVER":
            return self.params["longPeriod"]
        elif self.strategyType == "RSI":
            return self.params["rsiPeriod"] + 1
        elif self.strategyType == "MACD":
            return 35
        return 0


class MonteCarloRequest(BacktestRequest):
    """
    Monte Carlo request — same as backtest plus optional runs count.
    """
    runs: int = 30

    @field_validator("runs")
    @classmethod
    def validate_runs(cls, v: int) -> int:
        return max(5, min(v, 100))
