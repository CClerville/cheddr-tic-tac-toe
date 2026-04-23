import { forwardRef, useCallback, useState } from "react";
import { type PressableProps } from "react-native";

import { PressableScale } from "@/components/PressableScale";
import { useTheme } from "@/theme/ThemeProvider";
import {
  neumorphicButtonPressed,
  neumorphicButtonRaised,
} from "@/theme/effects";

export interface NeumorphicButtonProps extends PressableProps {}

/**
 * Raised neumorphic surface + press depth using theme shadow recipes.
 */
export const NeumorphicButton = forwardRef<
  React.ElementRef<typeof PressableScale>,
  NeumorphicButtonProps
>(function NeumorphicButton({ style, onPressIn, onPressOut, ...rest }, ref) {
  const { resolved } = useTheme();
  const [pressed, setPressed] = useState(false);
  const elevation = pressed
    ? neumorphicButtonPressed(resolved)
    : neumorphicButtonRaised(resolved);

  const handleIn = useCallback(
    (e: Parameters<NonNullable<PressableProps["onPressIn"]>>[0]) => {
      setPressed(true);
      onPressIn?.(e);
    },
    [onPressIn],
  );

  const handleOut = useCallback(
    (e: Parameters<NonNullable<PressableProps["onPressOut"]>>[0]) => {
      setPressed(false);
      onPressOut?.(e);
    },
    [onPressOut],
  );

  return (
    <PressableScale
      ref={ref}
      onPressIn={handleIn}
      onPressOut={handleOut}
      style={[elevation, style as object]}
      {...rest}
    />
  );
});
