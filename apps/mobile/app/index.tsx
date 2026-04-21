import { View, Text, Pressable, SafeAreaView } from "react-native";
import { Board } from "@/components/Board";
import { GameStatus } from "@/components/GameStatus";
import { DifficultyPicker } from "@/components/DifficultyPicker";
import { useGame } from "@/hooks/useGame";

export default function GameScreen() {
  const { gameState, difficulty, playMove, resetGame, changeDifficulty } =
    useGame("beginner");

  const isGameOver = gameState.result.status !== "in_progress";

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 items-center justify-between py-8 px-4">
        <View className="items-center gap-2">
          <Text className="text-3xl font-bold text-white tracking-tight">
            Misere Tic-Tac-Toe
          </Text>
          <Text className="text-sm text-zinc-500">
            Three-in-a-row loses!
          </Text>
        </View>

        <View className="items-center gap-6">
          <GameStatus
            result={gameState.result}
            currentPlayer={gameState.currentPlayer}
          />
          <Board
            board={gameState.board}
            onCellPress={playMove}
            disabled={isGameOver}
          />
        </View>

        <View className="items-center gap-4">
          <DifficultyPicker
            current={difficulty}
            onChange={changeDifficulty}
          />
          {isGameOver && (
            <Pressable
              onPress={resetGame}
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
