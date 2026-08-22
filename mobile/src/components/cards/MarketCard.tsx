import React from "react";

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { useNavigation } from "@react-navigation/native";

import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  Colors,
  Spacing,
  Typography,
  Radius,
} from "../../theme";

import { RootStackParamList } from "../../navigation/RootNavigator";
import { MarketQuote } from "../../types/Market";

type NavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

interface MarketCardProps {
  quote: MarketQuote;
}

export default function MarketCard({
  quote,
}: MarketCardProps) {
  const navigation =
    useNavigation<NavigationProp>();

  const change = quote.change_pct ?? 0;
  const isPositive = change >= 0;

  function handlePress() {
    navigation.navigate("MarketDetail", {
      symbol: quote.symbol,
    });
  }

  const formattedPrice =
    quote.last !== null &&
    quote.last !== undefined
      ? quote.last.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "N/A";

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.leftSection}>
        <View style={styles.titleRow}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={
                isPositive
                  ? "trending-up"
                  : "trending-down"
              }
              size={18}
              color={
                isPositive
                  ? Colors.positive
                  : Colors.negative
              }
            />
          </View>

          <View style={styles.nameContainer}>
            <Text
              style={styles.name}
              numberOfLines={1}
            >
              {quote.display_name}
            </Text>

            <Text style={styles.symbol}>
              {quote.symbol}
            </Text>
          </View>
        </View>

        <View style={styles.assetClassBadge}>
          <Text style={styles.assetClass}>
            {quote.asset_class}
          </Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        <Text style={styles.price}>
          {formattedPrice}
        </Text>

        <View style={styles.changeRow}>
          <Ionicons
            name={
              isPositive
                ? "arrow-up"
                : "arrow-down"
            }
            size={12}
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
                color: isPositive
                  ? Colors.positive
                  : Colors.negative,
              },
            ]}
          >
            {isPositive ? "+" : ""}
            {change.toFixed(2)}%
          </Text>
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={16}
        color={Colors.textMuted}
        style={styles.arrow}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",

    marginBottom: Spacing.sm,
    padding: Spacing.md,

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,
  },

  pressed: {
    opacity: 0.75,

    backgroundColor: Colors.surfaceHover,
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

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.sm,
  },

  nameContainer: {
    flex: 1,

    marginLeft: Spacing.sm,

    minWidth: 0,
  },

  name: {
    color: Colors.textPrimary,

    fontSize: Typography.body,
    fontWeight: "700",
  },

  symbol: {
    color: Colors.textMuted,

    fontSize: Typography.caption,

    marginTop: 2,
  },

  assetClassBadge: {
    alignSelf: "flex-start",

    marginTop: Spacing.sm,

    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,

    backgroundColor: Colors.surfaceElevated,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.sm,
  },

  assetClass: {
    color: Colors.textSecondary,

    fontSize: 10,
    fontWeight: "600",

    textTransform: "capitalize",
    letterSpacing: 0.4,
  },

  rightSection: {
    alignItems: "flex-end",

    marginLeft: Spacing.sm,
  },

  price: {
    color: Colors.textPrimary,

    fontSize: Typography.bodyMedium,
    fontWeight: "700",

    letterSpacing: 0.2,
  },

  changeRow: {
    flexDirection: "row",
    alignItems: "center",

    marginTop: 3,
  },

  change: {
    fontSize: Typography.caption,
    fontWeight: "600",

    marginLeft: 3,
  },

  arrow: {
    marginLeft: Spacing.sm,
  },
});