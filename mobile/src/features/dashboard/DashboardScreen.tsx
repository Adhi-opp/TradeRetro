import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../navigation/RootNavigator";

import {
  Colors,
  Spacing,
  Typography,
  Radius,
} from "../../theme";

type DashboardNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const navigation =
    useNavigation<DashboardNavigationProp>();

  function openBacktest() {
    navigation.navigate("Backtest", {});
  }

  function openMarket() {
    navigation.navigate("MainTabs", {
      screen: "Market",
    });
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* =================================================
            PAGE HEADER
        ================================================= */}

        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.titleAccent} />

            <View style={styles.titleContent}>
              <Text style={styles.eyebrow}>
                PRIMARY WORKSPACE
              </Text>

              <Text style={styles.title}>
                Backtesting Dashboard
              </Text>

              <Text style={styles.subtitle}>
                Event-driven validation for retail
                algorithmic trading strategies.
              </Text>
            </View>
          </View>
        </View>

        {/* =================================================
            BACKTEST ENGINE
        ================================================= */}

        <Pressable
          onPress={openBacktest}
          style={({ pressed }) => [
            styles.engineCard,
            pressed && styles.engineCardPressed,
          ]}
        >
          <View style={styles.engineHeader}>
            <View style={styles.engineHeaderText}>
              <View style={styles.engineLabelRow}>
                <View style={styles.statusDot} />

                <Text style={styles.engineEyebrow}>
                  BACKTEST ENGINE
                </Text>
              </View>

              <Text style={styles.engineTitle}>
                Configure, validate, execute
              </Text>
            </View>

            <View style={styles.workflowBadge}>
              <Text style={styles.workflowText}>
                MANUAL
              </Text>
            </View>
          </View>

          <Text style={styles.engineDescription}>
            Configure a strategy, select an asset,
            define the historical period and run
            the backtest.
          </Text>

          {/* SIX STEPS */}

          <View style={styles.stepsGrid}>
            <BacktestStep
              number="01"
              label="Strategy"
            />

            <BacktestStep
              number="02"
              label="Parameters"
            />

            <BacktestStep
              number="03"
              label="Risk"
            />

            <BacktestStep
              number="04"
              label="Asset"
            />

            <BacktestStep
              number="05"
              label="Period"
            />

            <BacktestStep
              number="06"
              label="Execute"
            />
          </View>

          <View style={styles.engineFooterRow}>
            <View>
              <Text style={styles.engineFooterLabel}>
                WORKFLOW STATUS
              </Text>

              <Text style={styles.engineFooter}>
                Ready to configure strategy
              </Text>
            </View>

            <View style={styles.actionIcon}>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={Colors.black}
              />
            </View>
          </View>
        </Pressable>

        {/* =================================================
            MARKET OVERVIEW
        ================================================= */}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>
              CROSS-ASSET MONITOR
            </Text>

            <Text style={styles.marketTitle}>
              Market Overview
            </Text>

            <Text style={styles.marketSubtitle}>
              Live market conditions
            </Text>
          </View>

          <Pressable
            onPress={openMarket}
            style={({ pressed }) => [
              styles.sectionAction,
              pressed && styles.sectionActionPressed,
            ]}
          >
            <Ionicons
              name="arrow-forward"
              size={17}
              color={Colors.primary}
            />
          </Pressable>
        </View>

        {/* =================================================
            NIFTY 50
        ================================================= */}

        <MarketOverviewCard
          icon="trending-down"
          iconColor={Colors.danger}
          name="NIFTY 50"
          symbol="NIFTY50.NS"
          price="24,361.12"
          change="-0.02%"
          positive={false}
        />

        {/* =================================================
            INDIA VIX
        ================================================= */}

        <MarketOverviewCard
          icon="trending-up"
          iconColor={Colors.success}
          name="INDIA VIX"
          symbol="INDIAVIX"
          price="11.31"
          change="+0.04%"
          positive
        />

        {/* =================================================
            MARKET FOOTER
        ================================================= */}

        <Pressable
          onPress={openMarket}
          style={({ pressed }) => [
            styles.marketFooter,
            pressed && styles.marketFooterPressed,
          ]}
        >
          <View>
            <Text style={styles.marketFooterEyebrow}>
              MARKET DATA
            </Text>

            <Text style={styles.marketFooterText}>
              View full market universe
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={17}
            color={Colors.textMuted}
          />
        </Pressable>
      </ScrollView>
    </View>
  );
}

/* =====================================================
   BACKTEST STEP
===================================================== */

function BacktestStep({
  number,
  label,
}: {
  number: string;
  label: string;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>
          {number}
        </Text>
      </View>

      <Text style={styles.stepLabel}>
        {label}
      </Text>
    </View>
  );
}

/* =====================================================
   MARKET OVERVIEW CARD
===================================================== */

function MarketOverviewCard({
  icon,
  iconColor,
  name,
  symbol,
  price,
  change,
  positive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  name: string;
  symbol: string;
  price: string;
  change: string;
  positive: boolean;
}) {
  return (
    <View style={styles.marketCard}>
      <View style={styles.marketCardHeader}>
        <View
          style={[
            styles.marketIcon,
            {
              borderColor: iconColor + "35",
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={18}
            color={iconColor}
          />
        </View>

        <View style={styles.simulatedBadge}>
          <View style={styles.simulatedDot} />

          <Text style={styles.simulatedText}>
            SIMULATED
          </Text>
        </View>
      </View>

      <View style={styles.marketValueRow}>
        <View style={styles.assetInfo}>
          <Text style={styles.assetName}>
            {name}
          </Text>

          <Text style={styles.assetSymbol}>
            {symbol}
          </Text>
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.assetPrice}>
            {price}
          </Text>

          <View style={styles.changeRow}>
            <Ionicons
              name={
                positive
                  ? "arrow-up"
                  : "arrow-down"
              }
              size={11}
              color={
                positive
                  ? Colors.success
                  : Colors.danger
              }
            />

            <Text
              style={[
                styles.change,
                {
                  color: positive
                    ? Colors.success
                    : Colors.danger,
                },
              ]}
            >
              {change}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* =====================================================
   STYLES
===================================================== */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  content: {
    padding: Spacing.lg,
    paddingBottom: 48,
  },

  /* ===================================================
     HEADER
  =================================================== */

  header: {
    marginBottom: Spacing.xl,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  titleAccent: {
    width: 3,
    height: 58,

    marginTop: 4,
    marginRight: Spacing.md,

    backgroundColor: Colors.primary,

    borderRadius: 2,
  },

  titleContent: {
    flex: 1,
  },

  eyebrow: {
    color: Colors.primary,

    fontSize: 10,
    fontWeight: "700",

    letterSpacing: 1.5,

    marginBottom: 5,
  },

  title: {
    color: Colors.textPrimary,

    fontSize: 28,
    lineHeight: 34,

    fontWeight: "700",

    letterSpacing: -0.4,
  },

  subtitle: {
    marginTop: Spacing.sm,

    color: Colors.textSecondary,

    fontSize: Typography.body,
    lineHeight: 21,
  },

  /* ===================================================
     BACKTEST ENGINE
  =================================================== */

  engineCard: {
    marginBottom: 32,

    padding: Spacing.lg,

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.lg,
  },

  engineCardPressed: {
    opacity: 0.8,

    borderColor: Colors.primary,
  },

  engineHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  engineHeaderText: {
    flex: 1,

    paddingRight: Spacing.sm,
  },

  engineLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  statusDot: {
    width: 6,
    height: 6,

    marginRight: 7,

    borderRadius: 3,

    backgroundColor: Colors.success,
  },

  engineEyebrow: {
    color: Colors.primary,

    fontSize: 10,
    fontWeight: "700",

    letterSpacing: 1.3,
  },

  engineTitle: {
    marginTop: 8,

    color: Colors.textPrimary,

    fontSize: 22,
    lineHeight: 27,

    fontWeight: "600",
  },

  workflowBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.sm,
  },

  workflowText: {
    color: Colors.textMuted,

    fontSize: 9,
    fontWeight: "700",

    letterSpacing: 0.8,
  },

  engineDescription: {
    marginTop: Spacing.md,

    color: Colors.textSecondary,

    fontSize: Typography.body,
    lineHeight: 21,
  },

  /* ===================================================
     SIX STEPS
  =================================================== */

  stepsGrid: {
    marginTop: Spacing.lg,

    flexDirection: "row",
    flexWrap: "wrap",

    justifyContent: "space-between",

    borderTopWidth: 1,
    borderTopColor: Colors.border,

    paddingTop: Spacing.lg,
  },

  step: {
    width: "48%",

    flexDirection: "row",
    alignItems: "center",

    marginBottom: Spacing.md,
  },

  stepNumber: {
    width: 30,
    height: 30,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.sm,
  },

  stepNumberText: {
    color: Colors.primary,

    fontSize: 10,
    fontWeight: "700",

    letterSpacing: 0.4,
  },

  stepLabel: {
    marginLeft: Spacing.sm,

    color: Colors.textSecondary,

    fontSize: Typography.caption,
    fontWeight: "600",
  },

  engineFooterRow: {
    marginTop: Spacing.sm,

    paddingTop: Spacing.md,

    borderTopWidth: 1,
    borderTopColor: Colors.border,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  engineFooterLabel: {
    color: Colors.textMuted,

    fontSize: 8,
    fontWeight: "700",

    letterSpacing: 1,
  },

  engineFooter: {
    marginTop: 3,

    color: Colors.textSecondary,

    fontSize: Typography.caption,
  },

  actionIcon: {
    width: 34,
    height: 34,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: Colors.primary,

    borderRadius: Radius.sm,
  },

  /* ===================================================
     MARKET HEADER
  =================================================== */

  sectionHeader: {
    marginBottom: Spacing.md,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionEyebrow: {
    color: Colors.primary,

    fontSize: 9,
    fontWeight: "700",

    letterSpacing: 1.2,
  },

  marketTitle: {
    marginTop: 4,

    color: Colors.textPrimary,

    fontSize: 21,
    fontWeight: "600",
  },

  marketSubtitle: {
    marginTop: 3,

    color: Colors.textMuted,

    fontSize: Typography.caption,
  },

  sectionAction: {
    width: 34,
    height: 34,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.sm,
  },

  sectionActionPressed: {
    opacity: 0.6,
  },

  /* ===================================================
     MARKET CARDS
  =================================================== */

  marketCard: {
    marginBottom: Spacing.sm,

    padding: Spacing.md,

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,
  },

  marketCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  marketIcon: {
    width: 34,
    height: 34,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,

    borderRadius: Radius.sm,
  },

  simulatedBadge: {
    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 8,
    paddingVertical: 5,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.sm,
  },

  simulatedDot: {
    width: 5,
    height: 5,

    marginRight: 5,

    borderRadius: 3,

    backgroundColor: Colors.textMuted,
  },

  simulatedText: {
    color: Colors.textMuted,

    fontSize: 8,
    fontWeight: "700",

    letterSpacing: 0.8,
  },

  marketValueRow: {
    marginTop: Spacing.md,

    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  assetInfo: {
    flex: 1,
  },

  assetName: {
    color: Colors.textPrimary,

    fontSize: 17,
    fontWeight: "600",
  },

  assetSymbol: {
    marginTop: 3,

    color: Colors.textMuted,

    fontSize: 11,

    letterSpacing: 0.4,
  },

  priceContainer: {
    alignItems: "flex-end",
  },

  assetPrice: {
    color: Colors.textPrimary,

    fontSize: 19,

    fontWeight: "700",

    letterSpacing: 0.3,
  },

  changeRow: {
    flexDirection: "row",
    alignItems: "center",

    marginTop: 3,
  },

  change: {
    marginLeft: 3,

    fontSize: 11,
    fontWeight: "700",
  },

  /* ===================================================
     MARKET FOOTER
  =================================================== */

  marketFooter: {
    marginTop: Spacing.xs,

    padding: Spacing.md,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,
  },

  marketFooterPressed: {
    opacity: 0.7,
  },

  marketFooterEyebrow: {
    color: Colors.textMuted,

    fontSize: 8,
    fontWeight: "700",

    letterSpacing: 1,
  },

  marketFooterText: {
    marginTop: 3,

    color: Colors.textSecondary,

    fontSize: Typography.caption,
  },
});