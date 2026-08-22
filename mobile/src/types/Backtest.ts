export interface BacktestRequest {
  symbol: string;
  strategyType: string;
  params: Record<string, number>;
  startDate: string;
  endDate: string;
}

export interface BacktestMetrics {
  initialCapital: number;
  finalValue: number;
  totalReturn: number;
  totalReturnRupee: number;
  buyHoldReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  cagr: number;
  benchmarkCagr: number;
  alpha: number;
  informationRatio: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgProfitLoss: number;
  avgHoldingPeriod: number;
  exposurePct: number;
  startDate: string;
  endDate: string;
  totalDays: number;
}

export interface GrossMetrics {
  finalValue: number;
  totalReturn: number;
  totalReturnRupee: number;
  maxDrawdown: number;
  cagr: number;
  alpha: number;
  winRate: number;
  winningTrades: number;
}

export interface CostBreakdown {
  stt: number;
  brokerage: number;
  slippage: number;
  exchangeFees: number;
  gst: number;
  stampDuty: number;
  totalCosts: number;
  costPctOfCapital: number;
}

export interface EquityPoint {
  date: string;
  equity: number;
  grossEquity: number;
  cash: number;
  holdings: number;
  price: number;
}

export interface BacktestTrade {
  type: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  shares: number;
  profitLoss: number;
  grossProfitLoss: number;
  pnlPct: number;
  holdingPeriod: number;
  fee: number;
  isWin: boolean;
  isGrossWin: boolean;
  forceClose: boolean;
  exitReason: string;
}

export interface BacktestStrategy {
  strategyType: string;
  params: Record<string, number>;
}

export interface SimulationMeta {
  dataSource: string;
  regimeModel: string;
  costModel: string;
  seed: number | null;
  transactionCostModel: string;
}

export interface BacktestMetadata {
  executionTimeMs: number;
  dataPoints: number;
  bufferedDataPoints: number;
  warmupCandlesRequested: number;
  warmupCandlesAvailable: number;
  timestamp: string;
  executionEngine: string;
  dataSource: string;
}

export interface BacktestResponse {
  metrics: BacktestMetrics;
  grossMetrics: GrossMetrics;
  costBreakdown: CostBreakdown;
  equityCurve: EquityPoint[];
  trades: BacktestTrade[];
  strategy: BacktestStrategy;
  simulationMeta: SimulationMeta;
  metadata: BacktestMetadata;
}