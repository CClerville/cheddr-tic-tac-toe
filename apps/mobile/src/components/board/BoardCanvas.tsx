import {
  Canvas,
  Group,
  Line,
  Path,
  RoundedRect,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/theme/ThemeProvider";
import { motion, type ThemePalette } from "@/theme/tokens";
import { WIN_LINES } from "@cheddr/game-engine";
import type { Board, GameResult, Position } from "@cheddr/game-engine";

import {
  ALL_POSITIONS,
  createBoardGeometry,
  getCellRect,
  getWinLineCoords,
} from "./boardGeometry";
import type { BoardGeometry } from "./boardGeometry";

interface BoardCanvasProps {
  board: Board;
  result: GameResult;
  size: number;
  /** Cell currently pressed (visual depth); null when none. */
  pressedCell: Position | null;
}

function findLossTriple(
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

function cellCornerRadius(geometry: BoardGeometry): number {
  return geometry.cellSize * 0.12;
}

interface NeumorphicCellProps {
  geometry: BoardGeometry;
  position: Position;
  palette: ThemePalette;
  scheme: "light" | "dark";
  pressed: boolean;
}

function NeumorphicCellFace({
  geometry,
  position,
  palette,
  scheme,
  pressed,
}: NeumorphicCellProps) {
  const rect = getCellRect(geometry, position);
  const inset = geometry.cellSize * 0.035;
  const x = rect.x + inset;
  const y = rect.y + inset;
  const w = rect.width - inset * 2;
  const h = rect.height - inset * 2;
  const r = cellCornerRadius(geometry);
  const depth = scheme === "dark" ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.07)";
  const hi =
    scheme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.85)";
  const face = pressed
    ? scheme === "dark"
      ? "rgba(255,255,255,0.05)"
      : "rgba(0,0,0,0.04)"
    : palette.elevated;
  const dx = pressed ? 1 : 3;
  const dy = pressed ? 1 : 4;

  return (
    <Group>
      <RoundedRect
        x={x + dx}
        y={y + dy}
        width={w}
        height={h}
        r={r}
        color={depth}
      />
      <RoundedRect
        x={x - (pressed ? 0 : 1)}
        y={y - (pressed ? 0 : 1)}
        width={w}
        height={h}
        r={r}
        color={hi}
      />
      <RoundedRect x={x} y={y} width={w} height={h} r={r} color={face} />
    </Group>
  );
}

interface XGlyphProps {
  cx: number;
  cy: number;
  radius: number;
  strokeWidth: number;
  color: string;
  glow: string;
}

function XGlyph({ cx, cy, radius, strokeWidth, color, glow }: XGlyphProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const path1 = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(cx - radius, cy - radius);
    p.lineTo(cx + radius, cy + radius);
    return p;
  }, [cx, cy, radius]);
  const path2 = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(cx - radius, cy + radius);
    p.lineTo(cx + radius, cy - radius);
    return p;
  }, [cx, cy, radius]);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
    });
  }, [cx, cy, radius, reduceMotion, progress]);

  return (
    <Group>
      <Path
        path={path1}
        style="stroke"
        strokeWidth={strokeWidth + 5}
        strokeCap="round"
        color={glow}
        opacity={0.28}
        end={progress}
      />
      <Path
        path={path2}
        style="stroke"
        strokeWidth={strokeWidth + 5}
        strokeCap="round"
        color={glow}
        opacity={0.28}
        end={progress}
      />
      <Path
        path={path1}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        color={color}
        end={progress}
      />
      <Path
        path={path2}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        color={color}
        end={progress}
      />
    </Group>
  );
}

interface OGlyphProps {
  cx: number;
  cy: number;
  radius: number;
  strokeWidth: number;
  color: string;
  glow: string;
}

function OGlyph({ cx, cy, radius, strokeWidth, color, glow }: OGlyphProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    const r = Skia.XYWHRect(cx - radius, cy - radius, radius * 2, radius * 2);
    p.addOval(r);
    return p;
  }, [cx, cy, radius]);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
    });
  }, [cx, cy, radius, reduceMotion, progress]);

  return (
    <Group>
      <Path
        path={path}
        style="stroke"
        strokeWidth={strokeWidth + 5}
        color={glow}
        opacity={0.3}
        end={progress}
      />
      <Path
        path={path}
        style="stroke"
        strokeWidth={strokeWidth}
        color={color}
        end={progress}
      />
    </Group>
  );
}

interface WinLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  duration: number;
}

function WinLine({ x1, y1, x2, y2, color, duration }: WinLineProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [x1, y1, x2, y2, duration, reduceMotion, progress]);
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

/** Amber celebration when the player wins (AI completed a line). */
function WinCelebrationLine({
  x1,
  y1,
  x2,
  y2,
  color,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(reduceMotion ? 1 : 0.72);
  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: motion.pulse / 2,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0.62, {
          duration: motion.pulse / 2,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      true,
    );
  }, [x1, y1, x2, y2, reduceMotion, pulse]);

  return (
    <Group>
      <Line
        p1={vec(x1, y1)}
        p2={vec(x2, y2)}
        color={color}
        style="stroke"
        strokeWidth={12}
        strokeCap="round"
        opacity={0.28}
      />
      <Line
        p1={vec(x1, y1)}
        p2={vec(x2, y2)}
        color={color}
        style="stroke"
        strokeWidth={7}
        strokeCap="round"
        opacity={pulse}
      />
    </Group>
  );
}

export function BoardCanvas({
  board,
  result,
  size,
  pressedCell,
}: BoardCanvasProps) {
  const { palette, resolved } = useTheme();
  const geometry = createBoardGeometry(size);
  const lossTriple = findLossTriple(board, result);
  const winLineCoords = lossTriple ? getWinLineCoords(geometry, lossTriple) : null;
  const playerWon = result.status === "loss" && result.loser === "O";

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
          {ALL_POSITIONS.map((pos) => (
            <NeumorphicCellFace
              key={`cell-${pos}`}
              geometry={geometry}
              position={pos}
              palette={palette}
              scheme={resolved}
              pressed={pressedCell === pos}
            />
          ))}
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
                strokeWidth={strokeWidth}
                color={palette.playerX}
                glow={palette.playerX}
              />
            );
          }
          return (
            <OGlyph
              key={`o-${pos}`}
              cx={rect.centerX}
              cy={rect.centerY}
              radius={glyphRadius}
              strokeWidth={strokeWidth}
              color={palette.playerO}
              glow={palette.playerO}
            />
          );
        })}

        {winLineCoords && playerWon ? (
          <WinCelebrationLine
            x1={winLineCoords.x1}
            y1={winLineCoords.y1}
            x2={winLineCoords.x2}
            y2={winLineCoords.y2}
            color={palette.win}
          />
        ) : null}

        {winLineCoords && !playerWon ? (
          <WinLine
            x1={winLineCoords.x1}
            y1={winLineCoords.y1}
            x2={winLineCoords.x2}
            y2={winLineCoords.y2}
            color={palette.loss}
            duration={motion.slow}
          />
        ) : null}
      </Canvas>
    </View>
  );
}
