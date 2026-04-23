import { type ReactNode, useEffect } from "react";
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/theme/ThemeProvider";

const PULSE_MIN = 0.42;
const PULSE_MAX = 0.95;
const PULSE_DURATION_MS = 900;

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Themed pulse skeleton for loading shells. Opacity animates unless reduced
 * motion is enabled (static mid-opacity).
 */
export function Skeleton({
  width = "100%",
  height = 16,
  radius = 8,
  style,
}: SkeletonProps) {
  const { palette } = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(PULSE_MAX);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = 0.78;
      return;
    }
    opacity.value = PULSE_MAX;
    opacity.value = withRepeat(
      withSequence(
        withTiming(PULSE_MIN, { duration: PULSE_DURATION_MS }),
        withTiming(PULSE_MAX, { duration: PULSE_DURATION_MS }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, [reduceMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: palette.glass,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.glassBorder,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function SkeletonCircle({
  size,
  style,
}: {
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const r = size / 2;
  return (
    <Skeleton
      width={size}
      height={size}
      radius={r}
      style={[{ alignSelf: "center" }, style]}
    />
  );
}

export function SkeletonText({
  width = "100%",
  lines = 1,
  lineHeight = 14,
  gap = 8,
  lastLineWidth = "72%",
}: {
  width?: DimensionValue;
  lines?: number;
  lineHeight?: number;
  gap?: number;
  /** Width of the last line when `lines` > 1 */
  lastLineWidth?: DimensionValue;
}) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 && lines > 1 ? lastLineWidth : width}
          height={lineHeight}
          radius={Math.max(4, lineHeight / 4)}
        />
      ))}
    </View>
  );
}

/** Wrap skeleton layouts for VoiceOver / TalkBack (busy progress region). */
export function SkeletonGroup({
  children,
  accessibilityLabel = "Loading",
}: {
  children: ReactNode;
  accessibilityLabel?: string;
}) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
    >
      {children}
    </View>
  );
}
