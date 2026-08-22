import { View, Text, StyleSheet } from "react-native";
import { Colors, Spacing, Typography } from "../../theme";

type Props = {
  title: string;
  value: string;
};

export default function InfoCard({ title, value }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
  },
  value: {
    marginTop: 8,
    fontSize: Typography.heading,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
});