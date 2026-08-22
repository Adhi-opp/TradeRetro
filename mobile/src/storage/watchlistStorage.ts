import AsyncStorage from "@react-native-async-storage/async-storage";

const WATCHLIST_KEY = "@traderetro_watchlist";

export async function saveWatchlist(
  symbols: string[],
): Promise<void> {
  await AsyncStorage.setItem(
    WATCHLIST_KEY,
    JSON.stringify(symbols),
  );
}

export async function loadWatchlist(): Promise<
  string[]
> {
  const stored = await AsyncStorage.getItem(
    WATCHLIST_KEY,
  );

  if (!stored) {
    return ["NIFTY50.NS"];
  }

  try {
    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return ["NIFTY50.NS"];
    }

    return parsed;
  } catch {
    return ["NIFTY50.NS"];
  }
}

export async function clearWatchlist(): Promise<void> {
  await AsyncStorage.removeItem(WATCHLIST_KEY);
}