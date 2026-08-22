import { apiRequest } from "./api";

import {
  BacktestRequest,
  BacktestResponse,
} from "../types/Backtest";

export async function runBacktest(
  request: BacktestRequest,
): Promise<BacktestResponse> {
  return apiRequest<BacktestResponse>(
    "/backtest",
    {
      method: "POST",
      body: JSON.stringify(request),
    },
  );
}