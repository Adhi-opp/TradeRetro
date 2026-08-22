{/*
 * WatchlistScreen.tsx
 *
 * This screen displays the user's choice of stocks or commodities.
 * Users can add or remove markets from their watchlist,
 * and view live price updates for each market.
 *
 * The watchlist is persisted in local storage, so it
 * remains available across app restarts.
 *
 * This is a special feature adapted for the TradeRetro app, not part of the web version.
 * It allows users to quickly access and monitor their preferred markets.
 */}

import React, { useCallback, useState } from "react";

import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import {
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";

import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  Colors,
  Spacing,
  Typography,
  Radius,
} from "../../theme";

import {
  RootStackParamList,
} from "../../navigation/RootNavigator";

import {
  getLiveQuotes,
  getMarketUniverse,
} from "../../services/marketService";

import {
  MarketAsset,
  MarketQuote,
} from "../../types/Market";

import {
  loadWatchlist,
  saveWatchlist,
} from "../../storage/watchlistStorage";

type NavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

export default function WatchlistScreen() {
  const navigation =
    useNavigation<NavigationProp>();

  const [assets, setAssets] =
    useState<MarketAsset[]>([]);

  const [quotes, setQuotes] =
    useState<MarketQuote[]>([]);

  const [watchlist, setWatchlist] =
    useState<string[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  /*
   * Load the latest watchlist and market data
   * whenever this screen becomes active.
   */
  const initializeWatchlist =
    useCallback(async () => {
      try {
        setLoading(true);

        const savedWatchlist =
          await loadWatchlist();

        setWatchlist(savedWatchlist);

        const universe =
          await getMarketUniverse();

        setAssets(universe);

        if (savedWatchlist.length > 0) {
          const liveQuotes =
            await getLiveQuotes(
              savedWatchlist,
            );

          setQuotes(liveQuotes);
        } else {
          setQuotes([]);
        }
      } catch (error) {
        console.error(
          "Failed to initialize watchlist:",
          error,
        );
      } finally {
        setLoading(false);
      }
    }, []);

  /*
   * Reload whenever the user comes back
   * to the Watchlist screen.
   */
  useFocusEffect(
    useCallback(() => {
      initializeWatchlist();
    }, [initializeWatchlist]),
  );

  /*
   * Refresh live prices.
   */
  async function refreshWatchlist() {
    try {
      setRefreshing(true);

      if (watchlist.length === 0) {
        setQuotes([]);
      } else {
        const liveQuotes =
          await getLiveQuotes(
            watchlist,
          );

        setQuotes(liveQuotes);
      }
    } catch (error) {
      console.error(
        "Failed to refresh watchlist:",
        error,
      );
    } finally {
      setRefreshing(false);
    }
  }

  /*
   * Add a market to the watchlist.
   */
  async function addToWatchlist(
    symbol: string,
  ) {
    if (watchlist.includes(symbol)) {
      return;
    }

    try {
      const updatedWatchlist = [
        ...watchlist,
        symbol,
      ];

      // Update UI immediately
      setWatchlist(updatedWatchlist);

      // Save to local storage
      await saveWatchlist(
        updatedWatchlist,
      );

      // Immediately get the new quote
      const newQuotes =
        await getLiveQuotes([symbol]);

      if (newQuotes.length > 0) {
        setQuotes((currentQuotes) => {
          const existingSymbols =
            new Set(
              currentQuotes.map(
                (quote) => quote.symbol,
              ),
            );

          const quotesToAdd =
            newQuotes.filter(
              (quote) =>
                !existingSymbols.has(
                  quote.symbol,
                ),
            );

          return [
            ...currentQuotes,
            ...quotesToAdd,
          ];
        });
      }
    } catch (error) {
      console.error(
        "Failed to add to watchlist:",
        error,
      );
    }
  }

  /*
   * Remove a market from the watchlist.
   */
  async function removeFromWatchlist(
    symbol: string,
  ) {
    try {
      const updatedWatchlist =
        watchlist.filter(
          (item) => item !== symbol,
        );

      // Update UI immediately
      setWatchlist(updatedWatchlist);

      // Remove quote immediately
      setQuotes((currentQuotes) =>
        currentQuotes.filter(
          (quote) =>
            quote.symbol !== symbol,
        ),
      );

      // Save updated watchlist
      await saveWatchlist(
        updatedWatchlist,
      );
    } catch (error) {
      console.error(
        "Failed to remove from watchlist:",
        error,
      );
    }
  }

  /*
   * Open market detail screen.
   */
  function openMarketDetail(
    symbol: string,
  ) {
    navigation.navigate(
      "MarketDetail",
      {
        symbol,
      },
    );
  }

  /*
   * Markets that are not currently
   * in the watchlist.
   */
  const availableAssets =
    assets.filter(
      (asset) =>
        !watchlist.includes(
          asset.symbol,
        ),
    );

  /*
   * Loading state.
   */
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={Colors.primary}
        />

        <Text style={styles.loadingText}>
          Loading watchlist...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* =================================================
          HEADER
      ================================================= */}

      <View style={styles.header}>
        <Text style={styles.title}>
          Watchlist
        </Text>

        <Text style={styles.subtitle}>
          Your selected markets
        </Text>
      </View>

      {/* =================================================
          WATCHLIST
      ================================================= */}

      <FlatList
        data={quotes}
        keyExtractor={(item) =>
          item.symbol
        }
        refreshing={refreshing}
        onRefresh={refreshWatchlist}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.watchlistContent,
          quotes.length === 0 &&
            styles.emptyList,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="star-outline"
                size={26}
                color={Colors.textMuted}
              />
            </View>

            <Text style={styles.emptyTitle}>
              Your watchlist is empty
            </Text>

            <Text style={styles.emptyText}>
              Add markets below to keep
              track of their latest prices.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const change =
            item.change_pct ?? 0;

          const isPositive =
            change >= 0;

          return (
            <Pressable
              onPress={() =>
                openMarketDetail(
                  item.symbol,
                )
              }
              style={({ pressed }) => [
                styles.card,
                pressed &&
                  styles.cardPressed,
              ]}
            >
              {/* LEFT SIDE */}

              <View
                style={styles.leftSection}
              >
                <View
                  style={styles.titleRow}
                >
                  <View
                    style={
                      styles.iconContainer
                    }
                  >
                    <Ionicons
                      name={
                        isPositive
                          ? "trending-up"
                          : "trending-down"
                      }
                      size={17}
                      color={
                        isPositive
                          ? Colors.positive
                          : Colors.negative
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.nameContainer
                    }
                  >
                    <Text
                      style={styles.name}
                      numberOfLines={1}
                    >
                      {
                        item.display_name
                      }
                    </Text>

                    <Text
                      style={styles.symbol}
                    >
                      {item.symbol}
                    </Text>
                  </View>
                </View>
              </View>

              {/* PRICE */}

              <View
                style={
                  styles.priceContainer
                }
              >
                <Text
                  style={styles.price}
                >
                  {item.last !== null &&
                  item.last !== undefined
                    ? `₹${item.last.toLocaleString(
                        "en-IN",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        },
                      )}`
                    : "N/A"}
                </Text>

                <View
                  style={styles.changeRow}
                >
                  <Ionicons
                    name={
                      isPositive
                        ? "arrow-up"
                        : "arrow-down"
                    }
                    size={11}
                    color={
                      isPositive
                        ? Colors.positive
                        : Colors.negative
                    }
                  />

                  <Text
                    style={[
                      styles.change,
                      {
                        color:
                          isPositive
                            ? Colors.positive
                            : Colors.negative,
                      },
                    ]}
                  >
                    {isPositive
                      ? "+"
                      : ""}
                    {change.toFixed(2)}%
                  </Text>
                </View>
              </View>

              {/* REMOVE */}

              <Pressable
                style={({ pressed }) => [
                  styles.removeButton,
                  pressed &&
                    styles.removeButtonPressed,
                ]}
                onPress={() =>
                  removeFromWatchlist(
                    item.symbol,
                  )
                }
                hitSlop={6}
              >
                <Ionicons
                  name="close"
                  size={15}
                  color={
                    Colors.negative
                  }
                />
              </Pressable>

              {/* ARROW */}

              <Ionicons
                name="chevron-forward"
                size={16}
                color={Colors.textMuted}
                style={styles.arrow}
              />
            </Pressable>
          );
        }}
      />

      {/* =================================================
          ADD MARKET
      ================================================= */}

      <Text style={styles.sectionTitle}>
        Add Market
      </Text>

      <FlatList
        data={availableAssets}
        keyExtractor={(item) =>
          item.symbol
        }
        horizontal
        showsHorizontalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.assetList
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.assetButton,
              pressed &&
                styles.assetButtonPressed,
            ]}
            onPress={() =>
              addToWatchlist(
                item.symbol,
              )
            }
          >
            <View
              style={styles.assetIcon}
            >
              <Ionicons
                name="add"
                size={16}
                color={Colors.primary}
              />
            </View>

            <Text
              style={styles.assetName}
              numberOfLines={1}
            >
              {item.display_name}
            </Text>

            <Text
              style={styles.assetSymbol}
              numberOfLines={1}
            >
              {item.symbol}
            </Text>

            <Text
              style={styles.addText}
            >
              + Add
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      Colors.background,
    paddingTop: 60,
    paddingHorizontal:
      Spacing.md,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.md,
    backgroundColor:
      Colors.background,
  },

  loadingText: {
    marginTop: Spacing.sm,
    color: Colors.textMuted,
    fontSize: Typography.body,
  },

  /* =====================================================
     HEADER
  ===================================================== */

  header: {
    marginBottom: Spacing.md,
  },

  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  subtitle: {
    marginTop: Spacing.xs,
    fontSize: Typography.body,
    color: Colors.textMuted,
  },

  /* =====================================================
     WATCHLIST
  ===================================================== */

  watchlistContent: {
    paddingBottom: Spacing.md,
  },

  emptyList: {
    flexGrow: 1,
  },

  emptyContainer: {
    alignItems: "center",
    paddingHorizontal:
      Spacing.lg,
    paddingTop: 50,
  },

  emptyIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    backgroundColor:
      Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },

  emptyTitle: {
    fontSize: Typography.bodyMedium,
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  emptyText: {
    marginTop: Spacing.xs,
    fontSize: Typography.caption,
    lineHeight: 20,
    textAlign: "center",
    color: Colors.textMuted,
  },

  /* =====================================================
     WATCHLIST CARD
  ===================================================== */

  card: {
    flexDirection: "row",
    alignItems: "center",

    marginBottom: Spacing.sm,
    padding: Spacing.md,

    backgroundColor:
      Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,
  },

  cardPressed: {
    opacity: 0.75,
    backgroundColor:
      Colors.surfaceHover,
  },

  leftSection: {
    flex: 1,
    minWidth: 0,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconContainer: {
    width: 34,
    height: 34,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor:
      Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.sm,
  },

  nameContainer: {
    flex: 1,
    minWidth: 0,
    marginLeft: Spacing.sm,
  },

  name: {
    color: Colors.textPrimary,
    fontSize: Typography.body,
    fontWeight: "700",
  },

  symbol: {
    marginTop: 2,
    color: Colors.textMuted,
    fontSize: Typography.caption,
  },

  /* =====================================================
     PRICE
  ===================================================== */

  priceContainer: {
    alignItems: "flex-end",
    marginLeft: Spacing.sm,
  },

  price: {
    color: Colors.textPrimary,
    fontSize:
      Typography.bodyMedium,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },

  change: {
    marginLeft: 3,
    fontSize: Typography.caption,
    fontWeight: "600",
  },

  /* =====================================================
     REMOVE
  ===================================================== */

  removeButton: {
    width: 28,
    height: 28,

    alignItems: "center",
    justifyContent: "center",

    marginLeft: Spacing.sm,

    backgroundColor:
      Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.sm,
  },

  removeButtonPressed: {
    opacity: 0.6,
  },

  arrow: {
    marginLeft: Spacing.sm,
  },

  /* =====================================================
     ADD MARKET
  ===================================================== */

  sectionTitle: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,

    fontSize: Typography.bodyMedium,
    fontWeight: "700",

    color: Colors.textPrimary,
  },

  assetList: {
    paddingBottom: Spacing.md,
  },

  assetButton: {
    minWidth: 150,

    padding: Spacing.md,
    marginRight: Spacing.sm,

    backgroundColor:
      Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,
  },

  assetButtonPressed: {
    opacity: 0.75,
    backgroundColor:
      Colors.surfaceHover,
  },

  assetIcon: {
    width: 28,
    height: 28,

    alignItems: "center",
    justifyContent: "center",

    marginBottom: Spacing.sm,

    backgroundColor:
      Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.sm,
  },

  assetName: {
    fontSize: Typography.body,
    fontWeight: "600",
    color: Colors.textPrimary,
  },

  assetSymbol: {
    marginTop: 3,
    fontSize: Typography.caption,
    color: Colors.textMuted,
  },

  addText: {
    marginTop: Spacing.sm,
    fontSize: Typography.caption,
    fontWeight: "700",
    color: Colors.primary,
  },
});