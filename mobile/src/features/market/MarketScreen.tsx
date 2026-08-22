import React, { useEffect, useState } from "react";

import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import MarketCard from "../../components/cards/MarketCard";

import {
  getLiveQuotes,
  getMarketUniverse,
} from "../../services/marketService";

import {
  MarketAsset,
  MarketQuote,
} from "../../types/Market";

import {
  Colors,
  Spacing,
  Typography,
  Radius,
} from "../../theme";

export default function MarketScreen() {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMarketData() {
    try {
      setError(null);

      const assets: MarketAsset[] =
        await getMarketUniverse();

      const symbols = assets.map(
        (asset) => asset.symbol,
      );

      if (symbols.length === 0) {
        setQuotes([]);
        return;
      }

      const results =
        await getLiveQuotes(symbols);

      const validQuotes = results.filter(
        (quote): quote is MarketQuote =>
          quote !== null &&
          quote.last !== null &&
          quote.last !== undefined,
      );

      setQuotes(validQuotes);
    } catch (err) {
      console.error(
        "Failed to load market data:",
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

  useEffect(() => {
    loadMarketData();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadMarketData();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={Colors.primary}
        />

        <Text style={styles.loadingText}>
          Loading market data...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>
          Market data unavailable
        </Text>

        <Text style={styles.error}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Market
        </Text>

        <Text style={styles.subtitle}>
          Live TradeRetro market data
        </Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusDot} />

        <View style={styles.statusTextContainer}>
          <Text style={styles.statusTitle}>
            Market data connected
          </Text>

          <Text style={styles.statusSubtitle}>
            Showing available live quotes
          </Text>
        </View>

        <Text style={styles.assetCount}>
          {quotes.length}
        </Text>
      </View>

      <FlatList
        data={quotes}
        keyExtractor={(item) => item.symbol}
        renderItem={({ item }) => (
          <MarketCard quote={item} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={[
          styles.list,
          quotes.length === 0 &&
            styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              No market data available
            </Text>

            <Text style={styles.emptyText}>
              The backend did not return any
              usable live prices.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // ==================================================
  // SCREEN
  // ==================================================

  container: {
    flex: 1,
    backgroundColor: Colors.background,

    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
  },

  // ==================================================
  // HEADER
  // ==================================================

  header: {
    marginBottom: Spacing.xl,
  },

  title: {
    fontSize: 30,
    lineHeight: 36,

    fontWeight: "700",

    color: Colors.textPrimary,

    letterSpacing: -0.4,
  },

  subtitle: {
    marginTop: Spacing.sm,

    fontSize: Typography.body,
    lineHeight: 21,

    color: Colors.textSecondary,
  },

  // ==================================================
  // CONNECTION STATUS
  // ==================================================

  statusCard: {
    marginBottom: Spacing.lg,

    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,

    borderRadius: Radius.lg,

    borderWidth: 1,
    borderColor: Colors.border,

    backgroundColor: Colors.surface,

    flexDirection: "row",
    alignItems: "center",
  },

  statusDot: {
    width: 9,
    height: 9,

    borderRadius: Radius.round,

    backgroundColor: "#16A34A",
  },

  statusTextContainer: {
    flex: 1,

    marginLeft: Spacing.md,
  },

  statusTitle: {
    fontSize: Typography.body,
    fontWeight: "700",

    color: Colors.textPrimary,
  },

  statusSubtitle: {
    marginTop: 3,

    fontSize: Typography.caption,

    color: Colors.textMuted,
  },

  assetCount: {
    fontSize: 20,
    fontWeight: "700",

    color: Colors.primary,
  },

  // ==================================================
  // MARKET LIST
  // ==================================================

  list: {
    paddingBottom: 100,
  },

  emptyList: {
    flexGrow: 1,
  },

  // ==================================================
  // LOADING / ERROR
  // ==================================================

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

  errorTitle: {
    marginBottom: Spacing.sm,

    fontSize: Typography.sectionTitle,
    fontWeight: "700",

    color: Colors.textPrimary,

    textAlign: "center",
  },

  error: {
    fontSize: Typography.body,

    color: Colors.negative,

    textAlign: "center",
  },

  // ==================================================
  // EMPTY STATE
  // ==================================================

  emptyContainer: {
    alignItems: "center",

    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
  },

  emptyTitle: {
    fontSize: Typography.sectionTitle,
    fontWeight: "700",

    color: Colors.textPrimary,

    textAlign: "center",
  },

  emptyText: {
    marginTop: Spacing.sm,

    fontSize: Typography.caption,
    lineHeight: 19,

    textAlign: "center",

    color: Colors.textMuted,
  },
});