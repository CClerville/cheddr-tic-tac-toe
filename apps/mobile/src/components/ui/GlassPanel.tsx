import { BlurView } from "expo-blur";
import { type ReactNode } from "react";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { glassPanel } from "@/theme/effects";

export interface GlassPanelProps extends ViewProps {
  children?: ReactNode;
  variant?: "panel" | "modal";
  /** Override default blur intensity from tokens */
  intensity?: number;
}

/**
 * Glass-style panel using expo-blur. Falls back to a tinted solid view on web,
 * older Android (API &lt; 31), or when blur is undesirable for perf.
 */
export function GlassPanel({
  children,
  variant = "panel",
  style,
  intensity: intensityOverride,
  ...rest
}: GlassPanelProps) {
  const { resolved } = useTheme();
  const recipe = glassPanel(resolved, variant);
  const intensity = Math.min(
    intensityOverride ?? recipe.blurIntensity,
    Platform.OS === "android" ? 30 : 80,
  );

  const preferBlur =
    variant === "modal" &&
    Platform.OS !== "web" &&
    !(Platform.OS === "android" && Number(Platform.Version) < 31);

  if (!preferBlur) {
    return (
      <View
        style={[
          styles.borderBase,
          {
            borderRadius: recipe.borderRadius,
            backgroundColor: recipe.backgroundColor,
            borderWidth: recipe.borderWidth,
            borderColor: recipe.borderColor,
          },
          style,
        ]}
        {...rest}
      >
        {children}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.borderBase,
        {
          borderRadius: recipe.borderRadius,
          borderWidth: recipe.borderWidth,
          borderColor: recipe.borderColor,
          overflow: "hidden",
        },
        style,
      ]}
      {...rest}
    >
      <BlurView
        intensity={intensity}
        tint={resolved === "dark" ? "dark" : "light"}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: recipe.backgroundColor },
        ]}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  borderBase: { overflow: "hidden" },
  content: { position: "relative" },
});
