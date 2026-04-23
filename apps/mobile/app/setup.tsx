import { router } from "expo-router";
import { useState } from "react";
import { Switch, Text, View } from "react-native";

import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useAuth } from "@clerk/clerk-expo";

import { DifficultyPicker } from "@/components/DifficultyPicker";
import { PressableScale } from "@/components/PressableScale";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { haptics } from "@/lib/haptics";
import { gameRepository } from "@/storage/gameRepository";
import type { Difficulty } from "@cheddr/game-engine";

const DESCRIPTIONS: Record<Difficulty, string> = {
  beginner: "Random moves. Great for learning the rules.",
  intermediate: "Optimal play 70% of the time. A real opponent.",
  expert: "Perfect play. Your best is a draw.",
};

export default function SetupScreen() {
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [ranked, setRanked] = useState(false);
  const { isSignedIn } = useAuth();

  return (
    <ScreenContainer>
      <ScreenHeader title="New Game" />

      <View className="flex-1 px-6 justify-center gap-10">
        <View className="items-center gap-2">
          <Text className="text-3xl font-bold text-primary dark:text-primary-dark">
            Choose difficulty
          </Text>
          <Text className="text-center text-secondary dark:text-secondary-dark">
            {DESCRIPTIONS[difficulty]}
          </Text>
        </View>

        <View className="items-center">
          <DifficultyPicker current={difficulty} onChange={setDifficulty} />
        </View>

        <GlassPanel variant="panel">
          <View className="px-4 py-3 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-primary dark:text-primary-dark font-semibold">
                Ranked
              </Text>
              <Text className="text-xs text-secondary dark:text-secondary-dark mt-1">
                {ranked
                  ? "Server-validated. Counts toward ELO and leaderboard."
                  : "Casual offline play. Doesn't affect rank."}
              </Text>
              {ranked && !isSignedIn ? (
                <Text className="text-xs text-accent dark:text-accent-dark mt-1">
                  Sign in to appear on the leaderboard.
                </Text>
              ) : null}
            </View>
            <Switch
              value={ranked}
              onValueChange={(v) => {
                haptics.selectionChange();
                setRanked(v);
              }}
              accessibilityLabel="Toggle ranked play"
            />
          </View>
        </GlassPanel>
      </View>

      <View className="px-6 pb-8">
        <PressableScale
          onPress={() => {
            void gameRepository.clearGame();
            router.replace({
              pathname: "/game",
              params: { difficulty, ranked: ranked ? "1" : "0" },
            });
            queueMicrotask(() => haptics.selectionChange());
          }}
          accessibilityRole="button"
          accessibilityLabel="Start game"
          className="bg-accent dark:bg-accent-dark py-4 rounded-full items-center"
        >
          <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold text-lg">
            Start Game
          </Text>
        </PressableScale>
      </View>
    </ScreenContainer>
  );
}
