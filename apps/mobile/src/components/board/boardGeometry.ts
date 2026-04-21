import type { Position } from "@cheddr/game-engine";

/**
 * Single source of truth for the 3x3 board's pixel geometry.
 *
 * Both the visual layer (`BoardCanvas` — Skia) and the input layer
 * (`Board` — Pressables for VoiceOver/TalkBack) derive their hit boxes,
 * line positions, and glyph bounds from this module. If they ever drift,
 * the touchable areas will silently miss the visible cells — so consolidating
 * the math here is a hard a11y requirement.
 */

export interface BoardGeometry {
  size: number;
  cellSize: number;
  /** Width of grid divider lines in points. */
  gridLineWidth: number;
  /** Padding inside each cell where glyphs are drawn (kept off the grid). */
  glyphInsetPt: number;
}

export interface CellRect {
  position: Position;
  row: 0 | 1 | 2;
  col: 0 | 1 | 2;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export const GLYPH_INSET_RATIO = 0.18;
export const GRID_LINE_WIDTH = 2;

export function createBoardGeometry(size: number): BoardGeometry {
  const cellSize = size / 3;
  return {
    size,
    cellSize,
    gridLineWidth: GRID_LINE_WIDTH,
    glyphInsetPt: cellSize * GLYPH_INSET_RATIO,
  };
}

export function getCellRect(
  geometry: BoardGeometry,
  position: Position,
): CellRect {
  const row = Math.floor(position / 3) as 0 | 1 | 2;
  const col = (position % 3) as 0 | 1 | 2;
  const x = col * geometry.cellSize;
  const y = row * geometry.cellSize;
  return {
    position,
    row,
    col,
    x,
    y,
    width: geometry.cellSize,
    height: geometry.cellSize,
    centerX: x + geometry.cellSize / 2,
    centerY: y + geometry.cellSize / 2,
  };
}

export const ALL_POSITIONS: Position[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Pixel coordinates for the win/loss line spanning a winning triple.
 * Endpoints are extended slightly past the outer cells for a polished look.
 */
export function getWinLineCoords(
  geometry: BoardGeometry,
  triple: readonly [Position, Position, Position],
  overshootRatio = 0.08,
): { x1: number; y1: number; x2: number; y2: number } {
  const start = getCellRect(geometry, triple[0]);
  const end = getCellRect(geometry, triple[2]);
  const overshoot = geometry.cellSize * overshootRatio;
  const dx = end.centerX - start.centerX;
  const dy = end.centerY - start.centerY;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  return {
    x1: start.centerX - ux * overshoot,
    y1: start.centerY - uy * overshoot,
    x2: end.centerX + ux * overshoot,
    y2: end.centerY + uy * overshoot,
  };
}
