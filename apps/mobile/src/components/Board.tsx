import { View } from "react-native";
import { Cell } from "./Cell";
import type { Board as BoardType, Position } from "@cheddr/game-engine";

interface BoardProps {
  board: BoardType;
  onCellPress: (position: Position) => void;
  disabled: boolean;
}

export function Board({ board, onCellPress, disabled }: BoardProps) {
  return (
    <View className="w-80 aspect-square">
      {[0, 1, 2].map((row) => (
        <View key={row} className="flex-row flex-1">
          {[0, 1, 2].map((col) => {
            const position = (row * 3 + col) as Position;
            return (
              <View
                key={position}
                className={`flex-1 ${
                  col < 2 ? "border-r border-zinc-600" : ""
                } ${row < 2 ? "border-b border-zinc-600" : ""}`}
              >
                <Cell
                  value={board[position]}
                  position={position}
                  onPress={onCellPress}
                  disabled={disabled}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
