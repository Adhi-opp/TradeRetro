export const BACKTEST_STRATEGIES = [
  {
    value: "MOVING_AVERAGE_CROSSOVER",
    label: "Moving Average Crossover",
  },
  {
    value: "RSI",
    label: "RSI",
  },
  {
    value: "MACD",
    label: "MACD",
  },
  {
    value: "BOLLINGER_BREAKOUT",
    label: "Bollinger Breakout",
  },
  {
    value: "DONCHIAN_BREAKOUT",
    label: "Donchian Breakout",
  },
] as const;

export type BacktestStrategy =
  (typeof BACKTEST_STRATEGIES)[number]["value"];