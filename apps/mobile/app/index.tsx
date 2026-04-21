import { Board } from "@/components/Board";
import { DifficultyPicker } from "@/components/DifficultyPicker";
import { GameStatus } from "@/components/GameStatus";
import { GAME_SCREEN_HORIZONTAL_INSET_PT } from "@/constants/gameScreenLayout";
import { useGame } from "@/hooks/useGame";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function GameScreen() {
  const { gameState, difficulty, playMove, resetGame, changeDifficulty } =
    useGame("beginner");

  const isGameOver = gameState.result.status !== "in_progress";

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View
        className="flex-1"
        style={{ paddingHorizontal: GAME_SCREEN_HORIZONTAL_INSET_PT }}
      >
        <View className="shrink-0 items-center pt-4 pb-2">
          <Text className="text-3xl font-bold text-white tracking-tight">
            Cheddr Tic-Tac-Toe
          </Text>
          <Text className="text-sm text-zinc-500">Three-in-a-row loses!</Text>
        </View>

        <ScrollView
          className="min-h-0 flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: 20,
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
            onCellPress={playMove}
            disabled={isGameOver}
          />
        </ScrollView>

        <View className="shrink-0 items-center gap-4 pb-6 pt-2">
          <DifficultyPicker current={difficulty} onChange={changeDifficulty} />
          {isGameOver && (
            <Pressable
              onPress={resetGame}
              accessibilityRole="button"
              accessibilityLabel="Play Again"
              accessibilityHint="Starts a new game with the same difficulty"
              className="bg-accent px-8 py-3 rounded-full active:opacity-80"
            >
              <Text className="text-zinc-900 font-semibold text-base">
                Play Again
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
