import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { motion } from "@/theme/tokens";

const RING_CYAN = "rgba(34, 211, 238, 0.75)";

const shellStyle = (size: number) => ({
  position: "absolute" as const,
  left: -6,
  top: -6,
  width: size + 12,
  height: size + 12,
  borderRadius: (size + 12) * 0.08,
  justifyContent: "center" as const,
  alignItems: "center" as const,
});

const ringBase = (size: number) => ({
  width: size + 8,
  height: size + 8,
  borderRadius: (size + 8) * 0.08,
  borderWidth: 2,
  backgroundColor: "transparent" as const,
});

/**
 * Subtle pulsing ring while the AI (O) is "thinking" — board is non-interactive.
 */
export function AiThinkingPulse({
  active,
  size,
}: {
  active: boolean;
  size: number;
}) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (!active || reduceMotion) {
      t.value = 0.5;
      return;
    }
    t.value = withRepeat(
      withTiming(1, {
        duration: motion.pulse / 2,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [active, reduceMotion, t]);

  const ringStyle = useAnimatedStyle(() => {
    const o = 0.55 + t.value * 0.45;
    return {
      opacity: o,
      borderColor: RING_CYAN,
    };
  });

  if (!active) return null;

  if (reduceMotion) {
    return (
      <View pointerEvents="none" style={shellStyle(size)}>
        <View
          style={[
            ringBase(size),
            { opacity: 0.82, borderColor: RING_CYAN },
          ]}
        />
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={shellStyle(size)}>
      <Animated.View style={[ringBase(size), ringStyle]} />
    </View>
  );
}
