import { Text, View } from "react-native";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import type { GameResult } from "@cheddr/game-engine";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { useTheme } from "@/theme/ThemeProvider";

interface GameStatusProps {
  result: GameResult;
  currentPlayer: "X" | "O";
}

export function GameStatus({ result, currentPlayer }: GameStatusProps) {
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? undefined : FadeInDown.springify().damping(16);
  const { palette } = useTheme();
  const dotColor =
    currentPlayer === "X" ? palette.playerX : palette.playerO;

  const turnRow = (
    <View className="flex-row items-center justify-center gap-2 px-3 py-2">
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: dotColor,
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text className="text-center text-lg text-secondary dark:text-secondary-dark">
        {currentPlayer === "X" ? "Your turn" : "AI thinking..."}
      </Text>
    </View>
  );

  if (result.status === "loss") {
    const message =
      result.loser === "X"
        ? "You completed 3-in-a-row. You lose!"
        : "AI completed 3-in-a-row. You win!";
    return (
      <GlassPanel
        variant="panel"
        style={{ width: "100%", maxWidth: 420, alignSelf: "center" }}
      >
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
      </GlassPanel>
    );
  }

  if (result.status === "draw") {
    return (
      <GlassPanel
        variant="panel"
        style={{ width: "100%", maxWidth: 420, alignSelf: "center" }}
      >
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
      </GlassPanel>
    );
  }

  return (
    <GlassPanel
      variant="panel"
      style={{ width: "100%", maxWidth: 420, alignSelf: "center" }}
    >
      <View accessibilityLiveRegion="polite">{turnRow}</View>
    </GlassPanel>
  );
}
