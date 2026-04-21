import { Text, View } from "react-native";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import type { GameResult } from "@cheddr/game-engine";

interface GameStatusProps {
  result: GameResult;
  currentPlayer: "X" | "O";
}

export function GameStatus({ result, currentPlayer }: GameStatusProps) {
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? undefined : FadeInDown.springify().damping(16);

  if (result.status === "loss") {
    const message =
      result.loser === "X"
        ? "You completed 3-in-a-row. You lose!"
        : "AI completed 3-in-a-row. You win!";
    return (
      <Animated.View
        entering={enter}
        accessibilityLiveRegion="assertive"
        className="items-center px-1 py-1"
      >
        <Text className="text-center text-2xl font-bold text-primary dark:text-primary-dark">
          {message}
        </Text>
        <Text className="mt-1 text-sm text-secondary dark:text-secondary-dark">
          Remember: three-in-a-row loses in Misere!
        </Text>
      </Animated.View>
    );
  }

  if (result.status === "draw") {
    return (
      <Animated.View
        entering={enter}
        accessibilityLiveRegion="assertive"
        className="items-center px-1 py-1"
      >
        <Text className="text-center text-2xl font-bold text-primary dark:text-primary-dark">
          Draw!
        </Text>
        <Text className="mt-1 text-sm text-secondary dark:text-secondary-dark">
          The board is full with no three-in-a-row.
        </Text>
      </Animated.View>
    );
  }

  return (
    <View accessibilityLiveRegion="polite" className="items-center px-1 py-1">
      <Text className="text-center text-lg text-secondary dark:text-secondary-dark">
        {currentPlayer === "X" ? "Your turn" : "AI thinking..."}
      </Text>
    </View>
  );
}
