import { StyleSheet, Text, View } from "react-native";

import { Colors, Spacing, Typography } from "../../theme";

type StatCardProps = {
  title: string;
  value: string;
  subtitle?: string;
};

export default function StatCard({
  title,
  value,
  subtitle,
}: StatCardProps) {
  const isPositive =
    value.startsWith("+") || subtitle?.startsWith("+");

  const isNegative =
    value.startsWith("-") || subtitle?.startsWith("-");

  const valueColor = isPositive
    ? Colors.success
    : isNegative
      ? Colors.danger
      : Colors.textPrimary;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {title.toUpperCase()}
        </Text>

        <View style={styles.indicator} />
      </View>

      <Text
        style={[
          styles.value,
          { color: valueColor },
        ]}
      >
        {value}
      </Text>

      {subtitle !== undefined && (
        <Text
          style={[
            styles.subtitle,
            {
              color: isPositive
                ? Colors.success
                : isNegative
                  ? Colors.danger
                  : Colors.textSecondary,
            },
          ]}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: 6,

    marginBottom: Spacing.md,

    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    marginBottom: Spacing.sm,
  },

  title: {
    color: Colors.textSecondary,

    fontSize: Typography.caption,
    fontWeight: "600",

    letterSpacing: 0.8,
  },

  indicator: {
    width: 6,
    height: 6,

    borderRadius: 3,

    backgroundColor: Colors.primary,
  },

  value: {
    fontSize: Typography.heading + 4,
    fontWeight: "700",

    letterSpacing: 0.2,
  },

  subtitle: {
    fontSize: Typography.caption,
    fontWeight: "500",

    marginTop: Spacing.xs,
  },
});