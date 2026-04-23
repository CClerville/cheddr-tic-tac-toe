import { useCallback, useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HintTooltip } from "@/components/ai/HintTooltip";
import { AiThinkingPulse } from "@/components/AiThinkingPulse";
import {
  GAME_SCREEN_HORIZONTAL_PADDING_TOTAL_PT,
  GAME_SCREEN_LAYOUT_RESERVE_Y_PT,
} from "@/constants/gameScreenLayout";
import { useTheme } from "@/theme/ThemeProvider";
import type {
  Board as BoardType,
  GameResult,
  Position,
} from "@cheddr/game-engine";

import { BoardCanvas } from "./board/BoardCanvas";
import {
  ALL_POSITIONS,
  createBoardGeometry,
  getCellRect,
  type BoardGeometry,
} from "./board/boardGeometry";
import { CellTouch } from "./CellTouch";

interface BoardProps {
  board: BoardType;
  result: GameResult;
  onCellPress: (position: Position) => void;
  disabled: boolean;
  /** True while the AI is computing / server is applying the opponent move. */
  aiThinking: boolean;
  /** Optional AI hint highlight (empty cell index). */
  hintCell?: Position | null;
  /** Hint explanation shown as a tooltip anchored to `hintCell`. */
  hintReasoning?: string;
  onDismissHint?: () => void;
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
  hintReasoning = "",
  onDismissHint,
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

  const hintTooltip =
    hintCell !== null &&
    hintReasoning.length > 0 &&
    onDismissHint !== undefined ? (
      <HintTooltipOverlay
        side={side}
        geometry={geometry}
        hintCell={hintCell}
        hintReasoning={hintReasoning}
        onDismissHint={onDismissHint}
      />
    ) : null;

  const showAiPulse = aiThinking;
  const dimColor =
    resolved === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";

  return (
    <View
      className="self-center"
      style={{ width: side, height: side, overflow: "visible" }}
    >
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
          opacity: showAiPulse ? 1 : 0,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          opacity: showAiPulse ? 1 : 0,
        }}
      >
        <AiThinkingPulse active={showAiPulse} size={side} />
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
      {hintTooltip}
    </View>
  );
}

const HINT_TOOLTIP_GAP_PT = 8;

function HintTooltipOverlay({
  side,
  geometry,
  hintCell,
  hintReasoning,
  onDismissHint,
}: {
  side: number;
  geometry: BoardGeometry;
  hintCell: Position;
  hintReasoning: string;
  onDismissHint: () => void;
}) {
  const cellRect = getCellRect(geometry, hintCell);
  const row = Math.floor(hintCell / 3) as 0 | 1 | 2;
  const showBelow = row === 0;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 5,
      }}
    >
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          ...(showBelow
            ? { top: cellRect.y + cellRect.height + HINT_TOOLTIP_GAP_PT }
            : { bottom: side - cellRect.y + HINT_TOOLTIP_GAP_PT }),
        }}
      >
        <HintTooltip
          reasoning={hintReasoning}
          onDismiss={onDismissHint}
          caretEdge={showBelow ? "top" : "bottom"}
          caretCenterX={cellRect.centerX}
          boardSide={side}
        />
      </View>
    </View>
  );
}
