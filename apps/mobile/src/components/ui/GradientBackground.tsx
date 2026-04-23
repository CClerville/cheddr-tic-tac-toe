import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

export function GradientBackground({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useTheme();

  return (
    <LinearGradient
      colors={[palette.surfaceTop, palette.surface, palette.surfaceBottom]}
      locations={[0, 0.45, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.fill, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
