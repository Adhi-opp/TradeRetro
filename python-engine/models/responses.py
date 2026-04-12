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
    maxDrawdown: float
    cagr: float
    benchmarkCagr: float
    alpha: float
    informationRatio: float
    totalTrades: int
    winningTrades: int
    losingTrades: int
    winRate: float
    avgProfitLoss: float
    avgHoldingPeriod: float
    startDate: str
    endDate: str
    totalDays: int


class GrossMetrics(BaseModel):
    finalValue: float
    totalReturn: float
    totalReturnRupee: float
    maxDrawdown: float
    cagr: float
    alpha: float
    winRate: float
    winningTrades: int


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
    fee: float
    isWin: bool
    isGrossWin: bool
    forceClose: bool


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


class DistributionStats(BaseModel):
    mean: float
    median: float
    stdDev: float
    min: float
    max: float
    percentile5: float
    percentile25: float
    percentile75: float
    percentile95: float
    positiveRuns: int
    totalRuns: int


class MonteCarloRunResult(BaseModel):
    seed: int
    totalReturn: float
    maxDrawdown: float
    winRate: float
    sharpeRatio: float
    totalTrades: int
    cagr: float
    alpha: float


class MonteCarloResponse(BaseModel):
    distribution: DistributionStats
    runs: list[MonteCarloRunResult]
    executionTimeMs: float
