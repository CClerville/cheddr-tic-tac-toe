import { forwardRef } from "react";
import { Pressable, type PressableProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends PressableProps {
  pressedScale?: number;
}

/**
 * Drop-in replacement for `<Pressable>` that scales down on press using a
 * Reanimated spring. Honors the system "reduce motion" preference by skipping
 * the animation entirely.
 */
export const PressableScale = forwardRef<
  React.ElementRef<typeof Pressable>,
  PressableScaleProps
>(function PressableScale(
  { pressedScale = 0.94, onPressIn, onPressOut, style, ...rest },
  ref,
) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { transform: [{ scale: 1 }] };
    return { transform: [{ scale: scale.value }] };
  });

  return (
    <AnimatedPressable
      ref={ref}
      onPressIn={(e) => {
        scale.value = withSpring(pressedScale, {
          damping: 18,
          stiffness: 320,
        });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
        onPressOut?.(e);
      }}
      style={[animatedStyle, style as object]}
      {...rest}
    />
  );
});
