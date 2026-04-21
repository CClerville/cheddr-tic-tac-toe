import { View, Text } from "react-native";
import type { GameResult } from "@cheddr/game-engine";

interface GameStatusProps {
  result: GameResult;
  currentPlayer: "X" | "O";
}

export function GameStatus({ result, currentPlayer }: GameStatusProps) {
  if (result.status === "loss") {
    const message =
      result.loser === "X"
        ? "You completed 3-in-a-row. You lose!"
        : "AI completed 3-in-a-row. You win!";

    return (
      <View className="items-center px-1 py-1">
        <Text className="text-center text-2xl font-bold text-white">
          {message}
        </Text>
        <Text className="mt-1 text-sm text-zinc-400">
          Remember: three-in-a-row loses in Misere!
        </Text>
      </View>
    );
  }

  if (result.status === "draw") {
    return (
      <View className="items-center px-1 py-1">
        <Text className="text-center text-2xl font-bold text-white">Draw!</Text>
        <Text className="mt-1 text-sm text-zinc-400">
          The board is full with no three-in-a-row.
        </Text>
      </View>
    );
  }

  return (
    <View className="items-center px-1 py-1">
      <Text className="text-center text-lg text-zinc-400">
        {currentPlayer === "X" ? "Your turn" : "AI thinking..."}
      </Text>
    </View>
  );
}
