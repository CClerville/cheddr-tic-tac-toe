import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Cell } from "./Cell";
import type { Board as BoardType, Position } from "@cheddr/game-engine";

/** Space for title, status copy, difficulty row, play-again, gaps (pt). */
const LAYOUT_RESERVE_Y = 360;

interface BoardProps {
  board: BoardType;
  onCellPress: (position: Position) => void;
  disabled: boolean;
}

export function Board({ board, onCellPress, disabled }: BoardProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const usableHeight =
    windowHeight - insets.top - insets.bottom - LAYOUT_RESERVE_Y;
  const maxByWidth = windowWidth - 32;
  const raw = Math.min(320, maxByWidth, usableHeight);
  const side = Math.floor(Math.max(160, raw));

  return (
    <View className="self-center" style={{ width: side, height: side }}>
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
