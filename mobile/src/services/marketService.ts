import { apiRequest } from "./api";

import {
  LiveQuotesResponse,
  MarketAsset,
  MarketQuote,
  HistoricalPricesResponse,
} from "../types/Market";

export async function getMarketUniverse(): Promise<
  MarketAsset[]
> {
  return apiRequest<MarketAsset[]>(
    "/universe",
  );
}

export async function getLiveQuotes(
  symbols: string[],
): Promise<MarketQuote[]> {
  if (symbols.length === 0) {
    return [];
  }

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const response =
          await apiRequest<{
            quotes: MarketQuote[];
          }>(
            `/live/quotes?symbols=${encodeURIComponent(
              symbol,
            )}`,
          );

        return response.quotes;
      } catch (error) {
        console.error(
          `Failed to get quote for ${symbol}:`,
          error,
        );

        return [];
      }
    }),
  );

  return results.flat();
}

export async function getHistoricalPrices(
  symbol: string,
  lookbackDays: number = 60,
): Promise<HistoricalPricesResponse> {
  return apiRequest<HistoricalPricesResponse>(
    `/live/prices/${encodeURIComponent(
      symbol,
    )}?lookback_days=${lookbackDays}`,
  );
}