import { Pressable, StyleSheet, Text } from "react-native";

import {
  Colors,
  Spacing,
  Typography,
  Radius,
} from "../../theme";

type AppButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
};

export default function AppButton({
  title,
  onPress,
  disabled = false,
}: AppButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: Colors.primary,

    borderRadius: Radius.md,

    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },

  pressed: {
    opacity: 0.8,
  },

  disabled: {
    opacity: 0.45,
  },

  text: {
    color: Colors.black,

    fontSize: Typography.body,
    fontWeight: "700",

    letterSpacing: 0.2,
  },
});