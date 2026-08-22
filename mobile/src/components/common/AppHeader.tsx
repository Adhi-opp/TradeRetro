import { StyleSheet, Text, View } from "react-native";

import {
  Colors,
  Spacing,
  Typography,
  Radius,
} from "../../theme";

type AppHeaderProps = {
  title: string;
};

export default function AppHeader({
  title,
}: AppHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>T</Text>
          </View>

          <View>
            <Text style={styles.brand}>
              TRADERETRO
            </Text>

            <Text style={styles.workspace}>
              PRIMARY WORKSPACE
            </Text>
          </View>
        </View>

        <View style={styles.connection}>
          <View style={styles.statusDot} />

          <Text style={styles.connectionText}>
            LIVE
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.titleRow}>
        <Text style={styles.title}>
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    paddingBottom: Spacing.md,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  logo: {
    width: 32,
    height: 32,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: Colors.primary,

    borderRadius: Radius.md,

    marginRight: Spacing.sm,
  },

  logoText: {
    color: Colors.black,

    fontSize: 18,
    fontWeight: "800",
  },

  brand: {
    color: Colors.textPrimary,

    fontSize: 14,
    fontWeight: "800",

    letterSpacing: 1.2,
  },

  workspace: {
    color: Colors.textMuted,

    fontSize: 9,
    fontWeight: "600",

    letterSpacing: 1,

    marginTop: 2,
  },

  connection: {
    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.sm,
  },

  statusDot: {
    width: 6,
    height: 6,

    borderRadius: 3,

    backgroundColor: Colors.success,

    marginRight: Spacing.xs,
  },

  connectionText: {
    color: Colors.success,

    fontSize: 9,
    fontWeight: "700",

    letterSpacing: 0.8,
  },

  divider: {
    height: 1,

    backgroundColor: Colors.border,

    marginBottom: Spacing.lg,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  title: {
    color: Colors.textPrimary,

    fontSize: Typography.title,
    fontWeight: "700",

    letterSpacing: -0.3,
  },
});