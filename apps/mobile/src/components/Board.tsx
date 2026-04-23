import { useCallback, useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AiThinkingPulse } from "@/components/AiThinkingPulse";
import {
  GAME_SCREEN_HORIZONTAL_PADDING_TOTAL_PT,
  GAME_SCREEN_LAYOUT_RESERVE_Y_PT,
} from "@/constants/gameScreenLayout";
import { useTheme } from "@/theme/ThemeProvider";
import type { Position } from "@cheddr/game-engine";

import { BoardCanvas } from "./board/BoardCanvas";
import {
  ALL_POSITIONS,
  createBoardGeometry,
  getCellRect,
} from "./board/boardGeometry";
import { CellTouch } from "./CellTouch";
import type { Board as BoardType, GameResult } from "@cheddr/game-engine";

interface BoardProps {
  board: BoardType;
  result: GameResult;
  onCellPress: (position: Position) => void;
  disabled: boolean;
  /** True while the AI is computing / server is applying the opponent move. */
  aiThinking: boolean;
  /** Optional AI hint highlight (empty cell index). */
  hintCell?: Position | null;
}

const MIN_BOARD_SIDE_PT = 160;
const MAX_BOARD_SIDE_PT = 320;

export function Board({
  board,
  result,
  onCellPress,
  disabled,
  aiThinking,
  hintCell = null,
}: BoardProps) {
  const { resolved } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [pressedCell, setPressedCell] = useState<Position | null>(null);

  const onPressStateChange = useCallback((pos: Position | null) => {
    setPressedCell(pos);
  }, []);

  const side = useMemo(() => {
    const usableHeight =
      windowHeight -
      insets.top -
      insets.bottom -
      GAME_SCREEN_LAYOUT_RESERVE_Y_PT;
    const maxByWidth = windowWidth - GAME_SCREEN_HORIZONTAL_PADDING_TOTAL_PT;
    const raw = Math.min(MAX_BOARD_SIDE_PT, maxByWidth, usableHeight);
    return Math.floor(Math.min(Math.max(MIN_BOARD_SIDE_PT, raw), maxByWidth));
  }, [windowWidth, windowHeight, insets.top, insets.bottom]);

  const geometry = useMemo(() => createBoardGeometry(side), [side]);

  const showAiPulse = aiThinking;
  const dimColor =
    resolved === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";

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
          zIndex: 0,
        }}
      >
        <BoardCanvas
          board={board}
          result={result}
          geometry={geometry}
          pressedCell={pressedCell}
          hintCell={hintCell}
        />
      </View>
      {showAiPulse ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: dimColor,
            zIndex: 1,
          }}
        />
      ) : null}
      {showAiPulse ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2,
          }}
        >
          <AiThinkingPulse active size={side} />
        </View>
      ) : null}
      <View
        accessible={false}
        accessibilityLabel="Game board"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: side,
          height: side,
          zIndex: 3,
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
              onPressStateChange={onPressStateChange}
            />
          );
        })}
      </View>
    </View>
  );
}
