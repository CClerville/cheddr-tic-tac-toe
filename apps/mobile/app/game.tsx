import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Board } from "@/components/Board";
import { GameStatus } from "@/components/GameStatus";
import { GAME_SCREEN_HORIZONTAL_INSET_PT } from "@/constants/gameScreenLayout";
import { useGame } from "@/hooks/useGame";
import { outcomeFromResult } from "@/storage/gameRepository";
import type { Difficulty } from "@cheddr/game-engine";

const VALID: Difficulty[] = ["beginner", "intermediate", "expert"];

function parseDifficulty(value: unknown): Difficulty {
  if (typeof value === "string" && (VALID as string[]).includes(value)) {
    return value as Difficulty;
  }
  return "intermediate";
}

export default function GameScreen() {
  const params = useLocalSearchParams();
  const initialDifficulty = parseDifficulty(params.difficulty);

  const { gameState, difficulty, phase, playMove, resetGame } = useGame({
    initialDifficulty,
    hydrate: false,
  });

  const navigatedToGameOverRef = useRef(false);

  useEffect(() => {
    if (phase !== "game_over") {
      navigatedToGameOverRef.current = false;
      return;
    }
    if (navigatedToGameOverRef.current) return;
    navigatedToGameOverRef.current = true;
    const outcome = outcomeFromResult(gameState.result) ?? "draw";
    const timer = setTimeout(() => {
      router.push({
        pathname: "/game-over",
        params: { outcome, difficulty },
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [phase, gameState.result, difficulty]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => router.replace("/")}
          accessibilityRole="button"
          accessibilityLabel="Quit"
          className="px-3 py-2"
        >
          <Text className="text-base text-accent dark:text-accent-dark">
            Quit
          </Text>
        </Pressable>
        <Text className="text-base font-semibold text-primary dark:text-primary-dark capitalize">
          {difficulty}
        </Text>
        <Pressable
          onPress={resetGame}
          accessibilityRole="button"
          accessibilityLabel="Reset game"
          className="px-3 py-2"
        >
          <Text className="text-base text-accent dark:text-accent-dark">
            Reset
          </Text>
        </Pressable>
      </View>

      <View
        className="flex-1"
        style={{ paddingHorizontal: GAME_SCREEN_HORIZONTAL_INSET_PT }}
      >
        <ScrollView
          className="min-h-0 flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: 24,
            paddingVertical: 8,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <GameStatus
            result={gameState.result}
            currentPlayer={gameState.currentPlayer}
          />
          <Board
            board={gameState.board}
            result={gameState.result}
            onCellPress={playMove}
            disabled={phase !== "player_turn"}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
