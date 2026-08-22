import type { ReactNode } from "react";
import {
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";

import { Colors, Spacing } from "../../theme";

type ScreenContainerProps = {
  children: ReactNode;
};

export default function ScreenContainer({
  children,
}: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  container: {
    flex: 1,

    backgroundColor: Colors.background,

    paddingHorizontal: Spacing.lg,
  },
});