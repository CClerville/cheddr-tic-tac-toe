import {
  Canvas,
  Circle,
  Group,
  Line,
  vec,
} from "@shopify/react-native-skia";
import { useEffect } from "react";
import { View } from "react-native";
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/theme/ThemeProvider";
import { WIN_LINES } from "@cheddr/game-engine";
import type { Board, GameResult, Position } from "@cheddr/game-engine";

import {
  ALL_POSITIONS,
  createBoardGeometry,
  getCellRect,
  getWinLineCoords,
} from "./boardGeometry";

interface BoardCanvasProps {
  board: Board;
  result: GameResult;
  size: number;
}

function findLosingLine(
  board: Board,
  result: GameResult,
): readonly [Position, Position, Position] | null {
  if (result.status !== "loss") return null;
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) {
      return line;
    }
  }
  return null;
}

interface XGlyphProps {
  cx: number;
  cy: number;
  radius: number;
  color: string;
  strokeWidth: number;
}

function XGlyph({ cx, cy, radius, color, strokeWidth }: XGlyphProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, reduceMotion]);
  return (
    <Group>
      <Line
        p1={vec(cx - radius, cy - radius)}
        p2={vec(cx + radius, cy + radius)}
        color={color}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        opacity={progress}
      />
      <Line
        p1={vec(cx - radius, cy + radius)}
        p2={vec(cx + radius, cy - radius)}
        color={color}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        opacity={progress}
      />
    </Group>
  );
}

interface OGlyphProps {
  cx: number;
  cy: number;
  radius: number;
  color: string;
  strokeWidth: number;
}

function OGlyph({ cx, cy, radius, color, strokeWidth }: OGlyphProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, reduceMotion]);
  return (
    <Circle
      cx={cx}
      cy={cy}
      r={radius}
      color={color}
      style="stroke"
      strokeWidth={strokeWidth}
      opacity={progress}
    />
  );
}

interface WinLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

function WinLine({ x1, y1, x2, y2, color }: WinLineProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, reduceMotion]);
  return (
    <Line
      p1={vec(x1, y1)}
      p2={vec(x2, y2)}
      color={color}
      style="stroke"
      strokeWidth={6}
      strokeCap="round"
      opacity={progress}
    />
  );
}

export function BoardCanvas({ board, result, size }: BoardCanvasProps) {
  const { palette } = useTheme();
  const geometry = createBoardGeometry(size);
  const losingLine = findLosingLine(board, result);
  const winLineCoords = losingLine ? getWinLineCoords(geometry, losingLine) : null;

  const glyphRadius = geometry.cellSize / 2 - geometry.glyphInsetPt;
  const strokeWidth = Math.max(4, geometry.cellSize * 0.06);

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: size, height: size }}
    >
      <Canvas style={{ width: size, height: size }}>
        <Group>
          <Line
            p1={vec(geometry.cellSize, 0)}
            p2={vec(geometry.cellSize, size)}
            color={palette.subtle}
            style="stroke"
            strokeWidth={geometry.gridLineWidth}
          />
          <Line
            p1={vec(geometry.cellSize * 2, 0)}
            p2={vec(geometry.cellSize * 2, size)}
            color={palette.subtle}
            style="stroke"
            strokeWidth={geometry.gridLineWidth}
          />
          <Line
            p1={vec(0, geometry.cellSize)}
            p2={vec(size, geometry.cellSize)}
            color={palette.subtle}
            style="stroke"
            strokeWidth={geometry.gridLineWidth}
          />
          <Line
            p1={vec(0, geometry.cellSize * 2)}
            p2={vec(size, geometry.cellSize * 2)}
            color={palette.subtle}
            style="stroke"
            strokeWidth={geometry.gridLineWidth}
          />
        </Group>

        {ALL_POSITIONS.map((pos) => {
          const value = board[pos];
          if (value === null) return null;
          const rect = getCellRect(geometry, pos);
          if (value === "X") {
            return (
              <XGlyph
                key={`x-${pos}`}
                cx={rect.centerX}
                cy={rect.centerY}
                radius={glyphRadius}
                color={palette.accent}
                strokeWidth={strokeWidth}
              />
            );
          }
          return (
            <OGlyph
              key={`o-${pos}`}
              cx={rect.centerX}
              cy={rect.centerY}
              radius={glyphRadius}
              color={palette.secondary}
              strokeWidth={strokeWidth}
            />
          );
        })}

        {winLineCoords && (
          <WinLine
            x1={winLineCoords.x1}
            y1={winLineCoords.y1}
            x2={winLineCoords.x2}
            y2={winLineCoords.y2}
            color={palette.danger}
          />
        )}
      </Canvas>
    </View>
  );
}
