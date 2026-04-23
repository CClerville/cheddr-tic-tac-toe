import { useMemo } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import type { CellValue, Position } from "@cheddr/game-engine";
import type { CellRect } from "./board/boardGeometry";

interface CellTouchProps {
  value: CellValue;
  position: Position;
  onPress: (position: Position) => void;
  disabled: boolean;
  rect: CellRect;
  onPressStateChange?: (position: Position | null) => void;
}

const ROW_NAMES = ["top", "middle", "bottom"] as const;
const COL_NAMES = ["left", "middle", "right"] as const;

const TAP_MAX_DISTANCE_PT = 16;
const TAP_MAX_DURATION_MS = 500;

function describeCell(rect: CellRect, value: CellValue): string {
  const occupant = value === null ? "empty" : value;
  return `${ROW_NAMES[rect.row]} ${COL_NAMES[rect.col]}, ${occupant}`;
}

export function CellTouch({
  value,
  position,
  onPress,
  disabled,
  rect,
  onPressStateChange,
}: CellTouchProps) {
  const occupied = value !== null;
  const interactive = !occupied && !disabled;

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(TAP_MAX_DISTANCE_PT)
        .maxDuration(TAP_MAX_DURATION_MS)
        .enabled(interactive)
        .runOnJS(true)
        .onBegin(() => {
          onPressStateChange?.(position);
        })
        .onFinalize(() => {
          onPressStateChange?.(null);
        })
        .onEnd((_event, success) => {
          if (success) onPress(position);
        }),
    [interactive, onPress, onPressStateChange, position],
  );

  return (
    <GestureDetector gesture={tap}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={describeCell(rect, value)}
        accessibilityState={{ disabled: !interactive }}
        accessibilityHint={
          interactive ? "Double-tap to place your piece" : undefined
        }
        style={{
          position: "absolute",
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
        }}
      />
    </GestureDetector>
  );
}
