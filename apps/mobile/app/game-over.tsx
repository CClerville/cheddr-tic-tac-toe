import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";

import { PressableScale } from "@/components/PressableScale";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { haptics } from "@/lib/haptics";
import type { GameOutcome } from "@/storage/gameRepository";
import { motion } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeProvider";
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
  const { palette } = useTheme();

  const emojiColor =
    outcome === "win"
      ? palette.accent
      : outcome === "loss"
        ? palette.playerX
        : palette.muted;

  return (
    <ScreenContainer variant="modal">
      <View
        className="flex-1 items-center justify-center px-6 py-8"
        accessibilityLiveRegion="assertive"
      >
        <GlassPanel variant="modal" style={{ width: "100%", maxWidth: 400 }}>
          <View className="px-5 py-8">
            <Animated.View
              entering={reduceMotion ? undefined : FadeIn.duration(motion.fast)}
              className="items-center"
            >
              <Text className="text-6xl mb-4" style={{ color: emojiColor }}>
                {copy.emoji}
              </Text>
              <Text className="text-3xl font-bold text-primary dark:text-primary-dark text-center">
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
                reduceMotion
                  ? undefined
                  : FadeInDown.delay(120).springify().damping(16)
              }
              className="w-full gap-3 mt-10"
            >
              <PressableScale
                onPress={() => {
                  router.replace({
                    pathname: "/game",
                    params: { difficulty },
                  });
                  queueMicrotask(() => haptics.selectionChange());
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
                className="bg-glass dark:bg-glass-dark border border-glassBorder dark:border-glassBorder-dark py-3 rounded-full items-center"
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
        </GlassPanel>
      </View>
    </ScreenContainer>
  );
}
