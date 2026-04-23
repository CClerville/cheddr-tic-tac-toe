import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { GameResult } from "@cheddr/game-engine";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { useTheme } from "@/theme/ThemeProvider";
import { motion } from "@/theme/tokens";

interface GameStatusProps {
  result: GameResult;
  currentPlayer: "X" | "O";
  /** Explicit AI-wait state (fixes ranked: stale currentPlayer during network). */
  aiThinking: boolean;
}

export function GameStatus({
  result,
  currentPlayer,
  aiThinking,
}: GameStatusProps) {
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? undefined : FadeInDown.springify().damping(16);
  const { palette } = useTheme();

  const activeMark: "X" | "O" = aiThinking ? "O" : currentPlayer;
  const activeColor =
    activeMark === "X" ? palette.playerX : palette.playerO;

  const turnLabel = aiThinking
    ? "AI thinking"
    : currentPlayer === "X"
      ? "Your Move"
      : "Opponent's Move";

  const turnRow = (
    <View className="flex-row items-center justify-center gap-3 px-3 py-2">
      <MarkBadge mark={activeMark} color={activeColor} pulsing />
      <View
        className="flex-row items-center justify-center"
        style={{ minWidth: 180 }}
      >
        <Text
          className="text-xl font-semibold text-primary dark:text-primary-dark"
          style={{ textAlign: "center" }}
        >
          {turnLabel}
        </Text>
        {aiThinking ? <ThinkingDots color={activeColor} /> : null}
      </View>
    </View>
  );

  let body: React.ReactNode;
  if (result.status === "loss") {
    const message =
      result.loser === "X"
        ? "You completed 3-in-a-row. You lose!"
        : "AI completed 3-in-a-row. You win!";
    body = (
      <Animated.View
        entering={enter}
        accessibilityLiveRegion="assertive"
        className="items-center px-3 py-3"
      >
        <Text className="text-center text-2xl font-bold text-primary dark:text-primary-dark">
          {message}
        </Text>
        <Text className="mt-1 text-sm text-secondary dark:text-secondary-dark">
          Remember: three-in-a-row loses in Misere!
        </Text>
      </Animated.View>
    );
  } else if (result.status === "draw") {
    body = (
      <Animated.View
        entering={enter}
        accessibilityLiveRegion="assertive"
        className="items-center px-3 py-3"
      >
        <Text className="text-center text-2xl font-bold text-primary dark:text-primary-dark">
          Draw!
        </Text>
        <Text className="mt-1 text-sm text-secondary dark:text-secondary-dark">
          The board is full with no three-in-a-row.
        </Text>
      </Animated.View>
    );
  } else {
    body = <View accessibilityLiveRegion="polite">{turnRow}</View>;
  }

  // Reserve enough height for the tallest variant (loss/draw two-line message)
  // so the panel — and everything below it — stays put when transitioning
  // between turn updates and terminal states.
  return (
    <GlassPanel
      variant="panel"
      style={{ width: "100%", maxWidth: 420, alignSelf: "center" }}
    >
      <View
        style={{
          minHeight: STATUS_PANEL_MIN_HEIGHT_PT,
          justifyContent: "center",
        }}
      >
        {body}
      </View>
    </GlassPanel>
  );
}

const STATUS_PANEL_MIN_HEIGHT_PT = 76;

const BADGE_SIZE = 26;

function MarkBadge({
  mark,
  color,
  pulsing,
}: {
  mark: "X" | "O";
  color: string;
  pulsing: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (!pulsing || reduceMotion) {
      t.value = 0;
      return;
    }
    t.value = withRepeat(
      withTiming(1, {
        duration: motion.pulse,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [pulsing, reduceMotion, t]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = 1 + t.value * 0.06;
    const opacity = 0.85 + t.value * 0.15;
    return { transform: [{ scale }], opacity };
  });

  const badge = (
    <View
      style={{
        width: BADGE_SIZE,
        height: BADGE_SIZE,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: withAlpha(color, 0.45),
        backgroundColor: withAlpha(color, 0.14),
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        style={{
          color,
          fontSize: 14,
          fontWeight: "800",
          lineHeight: 16,
          includeFontPadding: false,
        }}
      >
        {mark}
      </Text>
    </View>
  );

  if (!pulsing || reduceMotion) return badge;

  return <Animated.View style={animatedStyle}>{badge}</Animated.View>;
}

function ThinkingDots({ color }: { color: string }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <Text
        className="text-xl font-semibold text-primary dark:text-primary-dark"
        style={{ marginLeft: 2 }}
      >
        …
      </Text>
    );
  }

  return (
    <View
      className="flex-row items-end"
      style={{ marginLeft: 6, marginBottom: 4, height: 10, width: 22 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Dot color={color} delay={0} />
      <Dot color={color} delay={160} />
      <Dot color={color} delay={320} />
    </View>
  );
}

function Dot({ color, delay }: { color: string; delay: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: 360,
            easing: Easing.out(Easing.quad),
          }),
          withTiming(0, {
            duration: 360,
            easing: Easing.in(Easing.quad),
          }),
          withTiming(0, { duration: 240 }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, t]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -t.value * 4 }],
    opacity: 0.45 + t.value * 0.55,
  }));

  return (
    <Animated.View
      style={[
        {
          width: 4,
          height: 4,
          borderRadius: 2,
          marginHorizontal: 1.5,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

/**
 * Convert a hex (#RRGGBB) or rgb(a)() color to an rgba string with the given alpha.
 * Falls back to the input string if unparseable so we never crash on theme changes.
 */
function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  if (hex.startsWith("#") && (hex.length === 7 || hex.length === 4)) {
    const expanded =
      hex.length === 4
        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
        : hex;
    const r = parseInt(expanded.slice(1, 3), 16);
    const g = parseInt(expanded.slice(3, 5), 16);
    const b = parseInt(expanded.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgbMatch = hex.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/,
  );
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}
