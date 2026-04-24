import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";

import { AnalysisPanel } from "@/components/ai/AnalysisPanel";
import { PressableScale } from "@/components/PressableScale";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { haptics } from "@/lib/haptics";
import type { GameOutcome } from "@/storage/gameRepository";
import { useTheme } from "@/theme/ThemeProvider";
import { motion } from "@/theme/tokens";
import { PersonalitySchema, type Personality } from "@cheddr/api-types";
import type { Difficulty } from "@cheddr/game-engine";

const VALID_OUTCOMES: GameOutcome[] = ["win", "loss", "draw"];
const VALID_DIFFICULTY: Difficulty[] = ["beginner", "intermediate", "expert"];

function parseOutcome(value: unknown): GameOutcome {
  if (
    typeof value === "string" &&
    (VALID_OUTCOMES as string[]).includes(value)
  ) {
    return value as GameOutcome;
  }
  return "draw";
}

function parseDifficulty(value: unknown): Difficulty {
  if (
    typeof value === "string" &&
    (VALID_DIFFICULTY as string[]).includes(value)
  ) {
    return value as Difficulty;
  }
  return "intermediate";
}

function parseGameId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  ) {
    return null;
  }
  return id;
}

function parsePersonality(value: unknown): Personality {
  const r = PersonalitySchema.safeParse(value);
  return r.success ? r.data : "coach";
}

const OUTCOME_EMOJI: Record<GameOutcome, string> = {
  win: "★",
  loss: "✕",
  draw: "=",
};

export default function GameOverScreen() {
  const params = useLocalSearchParams();
  const outcome = parseOutcome(params.outcome);
  const difficulty = parseDifficulty(params.difficulty);
  const ranked = params.ranked === "1";
  const gameId = parseGameId(params.gameId);
  const personality = parsePersonality(params.personality);
  const reduceMotion = useReducedMotion();
  const { palette } = useTheme();
  const { t } = useTranslation();
  const copy = {
    title: t(`gameOver.${outcome}.title`),
    subtitle: t(`gameOver.${outcome}.subtitle`),
    emoji: OUTCOME_EMOJI[outcome],
  };

  const emojiColor =
    outcome === "win"
      ? palette.accent
      : outcome === "loss"
        ? palette.playerX
        : palette.muted;

  return (
    <ScreenContainer variant="modal">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}
        showsVerticalScrollIndicator={false}
        accessibilityLiveRegion="assertive"
      >
        <GlassPanel variant="modal" style={{ width: "100%", maxWidth: 400 }}>
          <View className="px-5 py-8">
            <Animated.View
              {...(reduceMotion ? {} : { entering: FadeIn.duration(motion.fast) })}
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
                {t("gameOver.difficultyLabel", { difficulty })}
              </Text>
              {gameId ? <AnalysisPanel gameId={gameId} /> : null}
            </Animated.View>

            <Animated.View
              {...(reduceMotion
                ? {}
                : {
                    entering: FadeInDown.delay(120).springify().damping(16),
                  })}
              className="w-full gap-3 mt-10"
            >
              <PressableScale
                onPress={() => {
                  router.replace({
                    pathname: "/game",
                    params: {
                      difficulty,
                      ranked: ranked ? "1" : "0",
                      ...(ranked ? { personality } : {}),
                    },
                  });
                  queueMicrotask(() => haptics.selectionChange());
                }}
                accessibilityRole="button"
                accessibilityLabel={t("gameOver.rematch")}
                accessibilityHint={t("gameOver.rematchHint")}
                className="bg-accent dark:bg-accent-dark py-4 rounded-full items-center"
              >
                <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold text-lg">
                  {t("gameOver.rematch")}
                </Text>
              </PressableScale>

              <PressableScale
                onPress={() => router.replace("/setup")}
                accessibilityRole="button"
                accessibilityLabel={t("gameOver.changeDifficulty")}
                className="bg-glass dark:bg-glass-dark border border-glassBorder dark:border-glassBorder-dark py-3 rounded-full items-center"
              >
                <Text className="text-primary dark:text-primary-dark font-medium text-base">
                  {t("gameOver.changeDifficulty")}
                </Text>
              </PressableScale>

              <PressableScale
                onPress={() => router.replace("/")}
                accessibilityRole="button"
                accessibilityLabel={t("common.home")}
                className="py-3 rounded-full items-center"
              >
                <Text className="text-secondary dark:text-secondary-dark text-base">
                  {t("common.home")}
                </Text>
              </PressableScale>
            </Animated.View>
          </View>
        </GlassPanel>
      </ScrollView>
    </ScreenContainer>
  );
}
