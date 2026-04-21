import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DifficultyPicker } from "@/components/DifficultyPicker";
import { PressableScale } from "@/components/PressableScale";
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

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="px-3 py-2"
        >
          <Text className="text-base text-accent dark:text-accent-dark">
            Back
          </Text>
        </Pressable>
        <Text className="text-base font-semibold text-primary dark:text-primary-dark">
          New Game
        </Text>
        <View className="w-12" />
      </View>

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
      </View>

      <View className="px-6 pb-8">
        <PressableScale
          onPress={async () => {
            haptics.selectionChange();
            await gameRepository.clearGame();
            router.replace({
              pathname: "/game",
              params: { difficulty },
            });
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
    </SafeAreaView>
  );
}
