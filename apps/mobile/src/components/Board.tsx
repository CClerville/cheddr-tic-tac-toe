import { useMemo } from "react";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  GAME_SCREEN_HORIZONTAL_PADDING_TOTAL_PT,
  GAME_SCREEN_LAYOUT_RESERVE_Y_PT,
} from "@/constants/gameScreenLayout";
import { BoardCanvas } from "./board/BoardCanvas";
import {
  ALL_POSITIONS,
  createBoardGeometry,
  getCellRect,
} from "./board/boardGeometry";
import { CellTouch } from "./CellTouch";
import type {
  Board as BoardType,
  GameResult,
  Position,
} from "@cheddr/game-engine";

interface BoardProps {
  board: BoardType;
  result: GameResult;
  onCellPress: (position: Position) => void;
  disabled: boolean;
}

const MIN_BOARD_SIDE_PT = 160;
const MAX_BOARD_SIDE_PT = 320;

export function Board({ board, result, onCellPress, disabled }: BoardProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const usableHeight =
    windowHeight -
    insets.top -
    insets.bottom -
    GAME_SCREEN_LAYOUT_RESERVE_Y_PT;
  const maxByWidth = windowWidth - GAME_SCREEN_HORIZONTAL_PADDING_TOTAL_PT;
  const raw = Math.min(MAX_BOARD_SIDE_PT, maxByWidth, usableHeight);
  const side = Math.floor(Math.min(Math.max(MIN_BOARD_SIDE_PT, raw), maxByWidth));

  const geometry = useMemo(() => createBoardGeometry(side), [side]);

  return (
    <View className="self-center" style={{ width: side, height: side }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <BoardCanvas board={board} result={result} size={side} />
      </View>
      <View
        accessible={false}
        accessibilityLabel="Game board"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: side,
          height: side,
        }}
      >
        {ALL_POSITIONS.map((position) => {
          const rect = getCellRect(geometry, position);
          return (
            <CellTouch
              key={position}
              value={board[position]}
              position={position}
              onPress={onCellPress}
              disabled={disabled}
              rect={rect}
            />
          );
        })}
      </View>
    </View>
  );
}
