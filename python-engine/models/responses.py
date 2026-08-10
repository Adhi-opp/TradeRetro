"""
Pydantic Response Models
========================
These enforce the exact JSON shape that RightPane.jsx expects.
Used for documentation and type safety — actual serialization
is done by SimulationEngine.generate_report().
"""

from typing import Optional

from pydantic import BaseModel


class BacktestMetrics(BaseModel):
    initialCapital: float
    finalValue: float
    totalReturn: float
    totalReturnRupee: float
    buyHoldReturn: float
    sharpeRatio: float
    sortinoRatio: float
    calmarRatio: float
    annualizedReturn: float
    annualizedVolatility: float
    downsideDeviation: float
    var95Daily: float
    maxDrawdown: float
    cagr: float
    benchmarkCagr: float
    excessCagr: float
    alpha: float               # deprecated mirror of excessCagr
    jensensAlpha: float
    beta: float
    betaRSquared: float
    informationRatio: float
    totalTrades: int
    winningTrades: int
    losingTrades: int
    winRate: float
    avgProfitLoss: float
    avgHoldingPeriod: float
    exposurePct: float
    startDate: str
    endDate: str
    totalDays: int


class GrossMetrics(BaseModel):
    """
    Mirrors every field the UI swaps in when the cost toggle is off. Missing
    keys silently fall through to the net metric, so this model is the
    contract that prevents a mixed net/gross header.
    """
    finalValue: float
    totalReturn: float
    totalReturnRupee: float
    maxDrawdown: float
    cagr: float
    excessCagr: float
    alpha: float               # deprecated mirror of excessCagr
    winRate: float
    winningTrades: int
    losingTrades: int
    sharpeRatio: float
    sortinoRatio: float
    calmarRatio: float
    annualizedReturn: float
    annualizedVolatility: float
    downsideDeviation: float
    var95Daily: float
    informationRatio: float


class CostBreakdown(BaseModel):
    stt: float
    brokerage: float
    slippage: float
    exchangeFees: float
    gst: float
    stampDuty: float
    totalCosts: float
    costPctOfCapital: float


class EquityCurvePoint(BaseModel):
    date: str
    equity: float
    grossEquity: float
    cash: float
    holdings: int
    price: float


class TradeRecord(BaseModel):
    type: str
    entryDate: str
    entryPrice: float
    exitDate: str
    exitPrice: float
    shares: int
    profitLoss: float
    grossProfitLoss: float
    pnlPct: float
    holdingPeriod: int
    fee: float                 # round trip: entryFee + exitFee
    entryFee: float
    exitFee: float
    isWin: bool
    isGrossWin: bool
    forceClose: bool
    exitReason: str  # "signal" | "stop" | "force_close"


class SimulationMeta(BaseModel):
    dataSource: str
    regimeModel: str
    costModel: str
    seed: Optional[int]
    transactionCostModel: str


class BacktestResponse(BaseModel):
    metrics: BacktestMetrics
    grossMetrics: GrossMetrics
    costBreakdown: CostBreakdown
    equityCurve: list[EquityCurvePoint]
    trades: list[TradeRecord]
    strategy: dict
    simulationMeta: SimulationMeta
