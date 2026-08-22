import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Colors } from "../../theme";

export default function Loading() {
  return (
    <View style={styles.container}>
      <ActivityIndicator
        size="large"
        color={Colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
});