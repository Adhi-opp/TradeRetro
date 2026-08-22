export interface MarketAsset {
  symbol: string;
  display_name: string;
  asset_class: string;
  added_at: string;
  last_backfill_at: string | null;
  backfill_status: string;
  backfill_job_id: string | null;
  row_count: number;
  earliest_date: string | null;
  latest_date: string | null;
}

export interface MarketQuote {
  symbol: string;
  display_name: string;
  asset_class: string;
  last: number | null;
  prev_close: number | null;
  change_pct: number | null;
  as_of: string;
  source: string;
  stale_days: number;
  tick_age_seconds: number;
}

export interface LiveQuotesResponse {
  quotes: MarketQuote[];
  source: string;
}

export interface HistoricalPricePoint {
  date: string;
  close: number;
}

export interface HistoricalPricesResponse {
  symbol: string;
  lookback_days: number;
  points: HistoricalPricePoint[];
  as_of: string;
  live_tail: boolean;
}