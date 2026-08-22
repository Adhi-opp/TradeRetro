import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Svg, {
  Polyline,
  Line,
  Circle,
} from "react-native-svg";

import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../navigation/RootNavigator";

import {
  getHistoricalPrices,
  getLiveQuotes,
} from "../../services/marketService";

import {
  addToWatchlist,
  isInWatchlist,
  removeFromWatchlist,
} from "../../services/watchlistService";

import {
  HistoricalPricePoint,
  MarketQuote,
} from "../../types/Market";

import {
  Colors,
  Spacing,
  Typography,
  Radius,
} from "../../theme";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "MarketDetail"
>;

type ChartPeriod = "1M" | "3M" | "6M" | "1Y";

/* =====================================================
   PRICE CHART
===================================================== */

function PriceChart({
  points,
}: {
  points: HistoricalPricePoint[];
}) {
  if (points.length === 0) {
    return (
      <Text style={styles.info}>
        No historical data available.
      </Text>
    );
  }

  const width = 340;
  const height = 220;
  const padding = 20;

  const prices = points.map(
    (point) => point.close,
  );

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const priceRange =
    maxPrice - minPrice || 1;

  const chartPoints = points.map(
    (point, index) => {
      const x =
        padding +
        (index /
          Math.max(points.length - 1, 1)) *
          (width - padding * 2);

      const y =
        height -
        padding -
        ((point.close - minPrice) /
          priceRange) *
          (height - padding * 2);

      return `${x},${y}`;
    },
  );

  const lastIndex = points.length - 1;

  const lastX =
    padding +
    (lastIndex /
      Math.max(points.length - 1, 1)) *
      (width - padding * 2);

  const lastY =
    height -
    padding -
    ((points[lastIndex].close - minPrice) /
      priceRange) *
      (height - padding * 2);

  return (
    <View style={styles.chartContainer}>
      <Svg
        width={width}
        height={height}
      >
        {/* Bottom axis */}

        <Line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke={Colors.border}
          strokeWidth="1"
        />

        {/* Left axis */}

        <Line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke={Colors.border}
          strokeWidth="1"
        />

        {/* Price line */}

        <Polyline
          points={chartPoints.join(" ")}
          fill="none"
          stroke={Colors.primary}
          strokeWidth="3"
        />

        {/* Latest price point */}

        <Circle
          cx={lastX}
          cy={lastY}
          r="5"
          fill={Colors.primary}
        />
      </Svg>

      <View style={styles.chartLabels}>
        <Text style={styles.chartLabel}>
          ₹
          {minPrice.toLocaleString("en-IN", {
            maximumFractionDigits: 0,
          })}
        </Text>

        <Text style={styles.chartLabel}>
          ₹
          {maxPrice.toLocaleString("en-IN", {
            maximumFractionDigits: 0,
          })}
        </Text>
      </View>
    </View>
  );
}

/* =====================================================
   MARKET DETAIL SCREEN
===================================================== */

export default function MarketDetailScreen({
  navigation,
  route,
}: Props) {
  const { symbol } = route.params;

  const [quote, setQuote] =
    useState<MarketQuote | null>(null);

  const [history, setHistory] =
    useState<HistoricalPricePoint[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [watchlisted, setWatchlisted] =
    useState(false);

  const [selectedPeriod, setSelectedPeriod] =
    useState<ChartPeriod>("1M");

  /* =====================================================
     PERIOD SETTINGS
  ===================================================== */

  const periodDays: Record<
    ChartPeriod,
    number
  > = {
    "1M": 22,
    "3M": 66,
    "6M": 132,
    "1Y": 252,
  };

  /* =====================================================
     LOAD MARKET DATA
  ===================================================== */

  async function loadData() {
    try {
      setError(null);

      const liveQuotes =
        await getLiveQuotes([symbol]);

      const historical =
        await getHistoricalPrices(
          symbol,
          periodDays[selectedPeriod],
        );

      if (liveQuotes.length > 0) {
        setQuote(liveQuotes[0]);
      } else {
        setQuote(null);
      }

      setHistory(historical.points);
    } catch (err) {
      console.error(
        "Failed to load market detail:",
        err,
      );

      setError(
        "Unable to load market data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /* =====================================================
     LOAD DATA WHEN SYMBOL OR PERIOD CHANGES
  ===================================================== */

  useEffect(() => {
    loadData();
  }, [symbol, selectedPeriod]);

  /* =====================================================
     CHECK WATCHLIST
  ===================================================== */

  useEffect(() => {
    async function checkWatchlist() {
      const result =
        await isInWatchlist(symbol);

      setWatchlisted(result);
    }

    checkWatchlist();
  }, [symbol]);

  /* =====================================================
     REFRESH
  ===================================================== */

  async function handleRefresh() {
    setRefreshing(true);

    await loadData();
  }

  /* =====================================================
     WATCHLIST TOGGLE
  ===================================================== */

  async function handleWatchlistToggle() {
    if (watchlisted) {
      await removeFromWatchlist(symbol);

      setWatchlisted(false);
    } else {
      await addToWatchlist(symbol);

      setWatchlisted(true);
    }
  }

  /* =====================================================
     FILTERED HISTORY
  ===================================================== */

  const filteredHistory =
    history.slice(
      -periodDays[selectedPeriod],
    );

  /* =====================================================
     LOADING STATE
  ===================================================== */

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading market data...
        </Text>
      </View>
    );
  }

  /* =====================================================
     ERROR STATE
  ===================================================== */

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {error}
        </Text>
      </View>
    );
  }

  /* =====================================================
     MAIN UI
  ===================================================== */

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      }
    >
      {/* =================================================
          MARKET NAME
      ================================================= */}

      <Text style={styles.title}>
        {quote?.display_name ?? symbol}
      </Text>

      <Text style={styles.symbol}>
        {symbol}
      </Text>

      {/* =================================================
          CURRENT PRICE
      ================================================= */}

      <View style={styles.priceCard}>
        <Text style={styles.priceLabel}>
          Current Price
        </Text>

        <Text style={styles.price}>
          {quote?.last != null
            ? `₹${quote.last.toLocaleString(
                "en-IN",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                },
              )}`
            : "N/A"}
        </Text>

        <Text
          style={[
          styles.change,
          quote?.change_pct != null &&
            (quote.change_pct >= 0
              ? styles.positive
              : styles.negative),
          ]}
        >
          {quote?.change_pct != null
            ? `${
              quote.change_pct >= 0
                ? "+"
                : ""
          }${quote.change_pct.toFixed(2)}%`
        : "N/A"}
        </Text>
      </View>

        {/* =================================================
            BACKTEST BUTTON
        ================================================= */}

      <Pressable
        style={({ pressed }) => [
          styles.backtestButton,
          pressed && styles.buttonPressed,
        ]}
        onPress={() =>
          navigation.navigate("Backtest", {
            symbol,
          })
        }
      >
        <Text style={styles.backtestButtonText}>
          Run Backtest
        </Text>
      </Pressable>

      {/* =================================================
          WATCHLIST BUTTON
      ================================================= */}

      <Pressable
        style={({ pressed }) => [
          styles.watchlistButton,
          watchlisted &&
            styles.watchlistButtonActive,
          pressed && styles.buttonPressed,
        ]}
        onPress={handleWatchlistToggle}
      >
        <Text
          style={[
            styles.watchlistButtonText,
            watchlisted &&
              styles.watchlistButtonTextActive,
          ]}
        >
          {watchlisted
            ? "★  Remove from Watchlist"
            : "☆  Add to Watchlist"}
          </Text>
        </Pressable>

      {/* =================================================
          PRICE HISTORY
      ================================================= */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Price History
        </Text>

        {/* PERIOD BUTTONS */}

        <View
          style={styles.periodContainer}
        >
          {(
            [
              "1M",
              "3M",
              "6M",
              "1Y",
            ] as ChartPeriod[]
          ).map((period) => (
            <Pressable
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period &&
                  styles.periodButtonSelected,
              ]}
              onPress={() =>
                setSelectedPeriod(period)
              }
            >
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === period &&
                    styles.periodButtonTextSelected,
                ]}
              >
                {period}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.info}>
          Showing{" "}
          {filteredHistory.length}{" "}
          trading days
        </Text>

        <PriceChart
          points={filteredHistory}
        />
      </View>
    </ScrollView>
  );
}

/* =====================================================
   STYLES
===================================================== */

const styles = StyleSheet.create({
  // ==================================================
  // SCREEN
  // ==================================================

  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },

  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.body,
    color: Colors.textSecondary,
  },

  error: {
    fontSize: Typography.body,
    color: Colors.negative,
    textAlign: "center",
  },

  // ==================================================
  // HEADER
  // ==================================================

  title: {
    marginTop: 60,
    paddingHorizontal: Spacing.lg,

    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",

    color: Colors.textPrimary,

    letterSpacing: -0.4,
  },

  symbol: {
    marginTop: 5,
    paddingHorizontal: Spacing.lg,

    fontSize: Typography.body,
    color: Colors.textMuted,
  },

  // ==================================================
  // CURRENT PRICE
  // ==================================================

  priceCard: {
    marginTop: Spacing.xl,
    marginHorizontal: Spacing.lg,

    padding: Spacing.xl,

    borderRadius: Radius.lg,

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,
  },

  priceLabel: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
  },

  price: {
    marginTop: 6,

    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",

    color: Colors.textPrimary,

    letterSpacing: -0.5,
  },

  change: {
    marginTop: 6,

    fontSize: 17,
    fontWeight: "700",
  },

  positive: {
    color: Colors.positive,
  },

  negative: {
    color: Colors.negative,
  },

  // ==================================================
  // ACTION BUTTONS
  // ==================================================

  backtestButton: {
    minHeight: 50,

    marginTop: Spacing.lg,
    marginHorizontal: Spacing.lg,

    borderRadius: Radius.md,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: Colors.primary,
  },

  backtestButtonText: {
    fontSize: Typography.body,
    fontWeight: "700",

    color: Colors.textOnPrimary,
  },

  buttonPressed: {
    opacity: 0.75,
  },

  watchlistButton: {
    minHeight: 48,

    marginTop: Spacing.sm,
    marginHorizontal: Spacing.lg,

    borderRadius: Radius.md,

    borderWidth: 1,
    borderColor: Colors.border,

    backgroundColor: Colors.surface,

    justifyContent: "center",
    alignItems: "center",
  },

  watchlistButtonActive: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.primary,
  },

  watchlistButtonText: {
    fontSize: Typography.body,
    fontWeight: "600",

    color: Colors.textSecondary,
  },

  watchlistButtonTextActive: {
    color: Colors.primary,
  },

  // ==================================================
  // PRICE HISTORY
  // ==================================================

  section: {
    marginTop: Spacing.xl,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,

    padding: Spacing.lg,

    borderRadius: Radius.lg,

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,
  },

  sectionTitle: {
    fontSize: Typography.sectionTitle,
    fontWeight: "700",

    color: Colors.textPrimary,
  },

  info: {
    marginTop: 5,
    marginBottom: 10,

    fontSize: Typography.caption,

    color: Colors.textMuted,
  },

  // ==================================================
  // PERIOD SELECTOR
  // ==================================================

  periodContainer: {
    flexDirection: "row",

    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,

    gap: Spacing.sm,
  },

  periodButton: {
    minWidth: 52,

    paddingVertical: 9,
    paddingHorizontal: 12,

    borderRadius: Radius.sm,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    alignItems: "center",
    justifyContent: "center",
  },

  periodButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  periodButtonText: {
    fontSize: Typography.caption,
    fontWeight: "700",

    color: Colors.textSecondary,
  },

  periodButtonTextSelected: {
    color: Colors.textOnPrimary,
  },

  // ==================================================
  // CHART
  // ==================================================

  chartContainer: {
    marginTop: Spacing.sm,
    alignItems: "center",
  },

  chartLabels: {
    width: "100%",

    flexDirection: "row",
    justifyContent: "space-between",

    paddingHorizontal: 10,
  },

  chartLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});