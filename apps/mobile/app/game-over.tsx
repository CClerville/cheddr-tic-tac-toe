import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { PressableScale } from "@/components/PressableScale";
import { haptics } from "@/lib/haptics";
import type { GameOutcome } from "@/storage/gameRepository";
import type { Difficulty } from "@cheddr/game-engine";

const VALID_OUTCOMES: GameOutcome[] = ["win", "loss", "draw"];
const VALID_DIFFICULTY: Difficulty[] = ["beginner", "intermediate", "expert"];

function parseOutcome(value: unknown): GameOutcome {
  if (typeof value === "string" && (VALID_OUTCOMES as string[]).includes(value)) {
    return value as GameOutcome;
  }
  return "draw";
}

function parseDifficulty(value: unknown): Difficulty {
  if (typeof value === "string" && (VALID_DIFFICULTY as string[]).includes(value)) {
    return value as Difficulty;
  }
  return "intermediate";
}

const COPY: Record<
  GameOutcome,
  { title: string; subtitle: string; emoji: string }
> = {
  win: {
    title: "You win!",
    subtitle: "The AI completed three-in-a-row.",
    emoji: "★",
  },
  loss: {
    title: "You lose",
    subtitle: "You completed three-in-a-row.",
    emoji: "✕",
  },
  draw: {
    title: "Draw",
    subtitle: "Nobody fell into a three-in-a-row trap.",
    emoji: "=",
  },
};

export default function GameOverScreen() {
  const params = useLocalSearchParams();
  const outcome = parseOutcome(params.outcome);
  const difficulty = parseDifficulty(params.difficulty);
  const copy = COPY[outcome];
  const reduceMotion = useReducedMotion();

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View
        className="flex-1 items-center justify-between px-6 py-10"
        accessibilityLiveRegion="assertive"
      >
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(250)}
          className="items-center mt-12"
        >
          <Text className="text-6xl text-accent dark:text-accent-dark mb-4">
            {copy.emoji}
          </Text>
          <Text className="text-4xl font-bold text-primary dark:text-primary-dark">
            {copy.title}
          </Text>
          <Text className="text-base text-secondary dark:text-secondary-dark mt-2 text-center">
            {copy.subtitle}
          </Text>
          <Text className="text-xs uppercase tracking-widest text-muted dark:text-muted-dark mt-4">
            {difficulty} difficulty
          </Text>
        </Animated.View>

        <Animated.View
          entering={
            reduceMotion ? undefined : FadeInDown.delay(150).springify().damping(16)
          }
          className="w-full gap-3"
        >
          <PressableScale
            onPress={() => {
              haptics.selectionChange();
              router.replace({
                pathname: "/game",
                params: { difficulty },
              });
            }}
            accessibilityRole="button"
            accessibilityLabel="Rematch"
            accessibilityHint="Starts a new game at the same difficulty"
            className="bg-accent dark:bg-accent-dark py-4 rounded-full items-center"
          >
            <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold text-lg">
              Rematch
            </Text>
          </PressableScale>

          <PressableScale
            onPress={() => router.replace("/setup")}
            accessibilityRole="button"
            accessibilityLabel="Change difficulty"
            className="bg-elevated dark:bg-elevated-dark py-3 rounded-full items-center"
          >
            <Text className="text-primary dark:text-primary-dark font-medium text-base">
              Change Difficulty
            </Text>
          </PressableScale>

          <PressableScale
            onPress={() => router.replace("/")}
            accessibilityRole="button"
            accessibilityLabel="Home"
            className="py-3 rounded-full items-center"
          >
            <Text className="text-secondary dark:text-secondary-dark text-base">
              Home
            </Text>
          </PressableScale>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
