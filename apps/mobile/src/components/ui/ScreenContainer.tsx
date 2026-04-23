import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { GradientBackground } from "@/components/ui/GradientBackground";

export type ScreenContainerVariant = "default" | "modal";

const modalEdges: Edge[] = ["top", "right", "bottom", "left"];

export function ScreenContainer({
  children,
  variant = "default",
  style,
}: {
  children: ReactNode;
  variant?: ScreenContainerVariant;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <GradientBackground style={styles.fill}>
      <SafeAreaView
        style={[styles.fill, style]}
        edges={variant === "modal" ? modalEdges : undefined}
      >
        {children}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
