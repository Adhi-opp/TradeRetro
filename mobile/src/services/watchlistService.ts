import AsyncStorage from "@react-native-async-storage/async-storage";

const WATCHLIST_KEY = "@traderetro_watchlist";

export async function getWatchlist(): Promise<string[]> {
  try {
    const stored =
      await AsyncStorage.getItem(
        WATCHLIST_KEY,
      );

    if (!stored) {
      return [];
    }

    return JSON.parse(stored);
  } catch (error) {
    console.error(
      "Failed to load watchlist:",
      error,
    );

    return [];
  }
}

export async function addToWatchlist(
  symbol: string,
): Promise<void> {
  try {
    const current =
      await getWatchlist();

    if (!current.includes(symbol)) {
      const updated = [
        ...current,
        symbol,
      ];

      await AsyncStorage.setItem(
        WATCHLIST_KEY,
        JSON.stringify(updated),
      );
    }
  } catch (error) {
    console.error(
      "Failed to add to watchlist:",
      error,
    );
  }
}

export async function removeFromWatchlist(
  symbol: string,
): Promise<void> {
  try {
    const current =
      await getWatchlist();

    const updated =
      current.filter(
        (item) => item !== symbol,
      );

    await AsyncStorage.setItem(
      WATCHLIST_KEY,
      JSON.stringify(updated),
    );
  } catch (error) {
    console.error(
      "Failed to remove from watchlist:",
      error,
    );
  }
}

export async function isInWatchlist(
  symbol: string,
): Promise<boolean> {
  const current =
    await getWatchlist();

  return current.includes(symbol);
}