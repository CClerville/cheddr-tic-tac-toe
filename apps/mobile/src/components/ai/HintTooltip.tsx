import { Pressable, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { radii, type ColorScheme } from "@/theme/tokens";

const CARET_SIZE = 8;
const GLOW_PAD = 3;

/** #RRGGBBAA accent rings for layered glow borders (matches light/dark accent tokens). */
function accentRingColor(scheme: ColorScheme, layer: "outer" | "mid" | "inner"): string {
  if (scheme === "dark") {
    if (layer === "outer") return "#F59E0B40";
    if (layer === "mid") return "#F59E0B73";
    return "#F59E0BBF";
  }
  if (layer === "outer") return "#D9770640";
  if (layer === "mid") return "#D9770673";
  return "#D97706BF";
}

export interface HintTooltipProps {
  reasoning: string;
  onDismiss: () => void;
  /** Caret on top edge pointing up (tooltip sits below the cell). */
  caretEdge: "top" | "bottom";
  /** Horizontal center of the caret in board-local coordinates. */
  caretCenterX: number;
  /** Board side length in points (for clamping caret). */
  boardSide: number;
}

export function HintTooltip({
  reasoning,
  onDismiss,
  caretEdge,
  caretCenterX,
  boardSide,
}: HintTooltipProps) {
  const { palette, resolved } = useTheme();
  const half = CARET_SIZE / 2;
  const caretOuterW = CARET_SIZE + 2;
  /** Left edge of the caret (clamped so the diamond stays on the board). */
  const caretLeftOuter = Math.min(
    Math.max(caretCenterX - caretOuterW / 2, 2),
    boardSide - caretOuterW - 2,
  );

  const outerGlowRadius = radii.lg + GLOW_PAD * 2 + 4;
  /** Soft accent halo (iOS shadow); Android leans on layered border rings below. */
  const accentHalo = {
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 0 } as const,
    shadowOpacity: resolved === "dark" ? 0.55 : 0.42,
    shadowRadius: resolved === "dark" ? 22 : 18,
    elevation: 0,
  };

  const cardShadow =
    resolved === "dark"
      ? {
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 6 } as const,
          shadowOpacity: 0.5,
          shadowRadius: 14,
          elevation: 12,
        }
      : {
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 4 } as const,
          shadowOpacity: 0.12,
          shadowRadius: 10,
          elevation: 6,
        };

  const caret = (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: caretLeftOuter,
        width: caretOuterW,
        height: caretOuterW,
        borderRadius: 2,
        backgroundColor: accentRingColor(resolved, "outer"),
        transform: [{ rotate: "45deg" }],
        zIndex: 1,
        alignItems: "center",
        justifyContent: "center",
        ...(caretEdge === "top"
          ? { top: -half }
          : { bottom: -half }),
      }}
    >
      <View
        style={{
          width: CARET_SIZE,
          height: CARET_SIZE,
          backgroundColor: palette.surfaceTop,
          borderWidth: 1,
          borderColor: accentRingColor(resolved, "inner"),
        }}
      />
    </View>
  );

  return (
    <View className="w-full" pointerEvents="box-none" style={{ overflow: "visible" }}>
      {caretEdge === "top" ? caret : null}
      <View
        style={{
          width: "100%",
          borderRadius: outerGlowRadius,
          padding: GLOW_PAD + 2,
          ...accentHalo,
        }}
      >
        <View
          style={{
            borderRadius: radii.lg + GLOW_PAD + 2,
            borderWidth: 2,
            borderColor: accentRingColor(resolved, "outer"),
            padding: 2,
          }}
        >
          <View
            style={{
              borderRadius: radii.lg + GLOW_PAD,
              borderWidth: 1.5,
              borderColor: accentRingColor(resolved, "mid"),
              padding: 1.5,
            }}
          >
            <View
              style={{
                borderRadius: radii.lg,
                backgroundColor: palette.surfaceTop,
                borderWidth: 1,
                borderColor: accentRingColor(resolved, "inner"),
                ...cardShadow,
              }}
            >
              <View className="px-3 py-2.5">
                <View className="flex-row justify-between items-start gap-2">
                  <Text
                    className="text-xs uppercase tracking-widest font-semibold"
                    style={{ color: palette.secondary }}
                  >
                    Hint
                  </Text>
                  <Pressable
                    onPress={onDismiss}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss hint"
                    hitSlop={10}
                  >
                    <Text
                      style={{ color: palette.secondary }}
                      className="text-base font-medium"
                    >
                      ✕
                    </Text>
                  </Pressable>
                </View>
                <Text
                  className="text-sm mt-1.5 leading-6"
                  style={{ color: palette.primary }}
                >
                  {reasoning}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
      {caretEdge === "bottom" ? caret : null}
    </View>
  );
}
