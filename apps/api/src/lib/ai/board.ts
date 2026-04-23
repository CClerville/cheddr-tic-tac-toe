import type { Board, Player, Position } from "@cheddr/game-engine";

/** Single source of truth for cell labels (index 0–8, row-major from top). */
export const CELL_NAMES = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;

export type CellName = (typeof CELL_NAMES)[number];

export function cellNameForPosition(pos: Position): CellName {
  return CELL_NAMES[pos];
}

const cell = (v: Board[number]): string => {
  if (v === "X") return "X";
  if (v === "O") return "O";
  return ".";
};

/**
 * ASCII board for LLM context (Misère rules described in system prompt).
 * Rows/columns labeled so models do not mis-map flat indices.
 */
export function serializeBoard(board: Board): string {
  const rows = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
  ] as const;
  const rowLabels = ["top", "mid", "bot"] as const;
  const header = "      L  C  R";
  const lines = rows.map((r, ri) => {
    const cells = r.map((i) => cell(board[i])).join("  ");
    return `${rowLabels[ri]}   ${cells}`;
  });
  return [header, ...lines].join("\n");
}

export function formatCellLegend(): string {
  return [
    `Cell name legend (always use these labels):`,
    `0=top-left  1=top-center  2=top-right`,
    `3=middle-left  4=center  5=middle-right`,
    `6=bottom-left  7=bottom-center  8=bottom-right`,
  ].join("\n");
}

export function formatMoveHistory(
  moveHistory: readonly Position[],
  humanPlayer: Player = "X",
): string {
  if (moveHistory.length === 0) return "(no moves yet)";
  return moveHistory
    .map((pos, idx) => {
      const p: Player = idx % 2 === 0 ? "X" : "O";
      const label = p === humanPlayer ? "Human" : "AI";
      const place = cellNameForPosition(pos);
      return `${idx + 1}. ${label} (${p}) → ${place} (cell ${pos})`;
    })
    .join("\n");
}

/** Last square the human (X) played, or null if none yet. */
export function lastHumanMovePosition(
  moveHistory: readonly Position[],
): Position | null {
  for (let m = moveHistory.length - 1; m >= 0; m--) {
    if (m % 2 === 0) return moveHistory[m]!;
  }
  return null;
}

export function formatLatestMoveLine(moveHistory: readonly Position[]): string {
  if (moveHistory.length === 0) return "Latest move: (none yet).";
  const idx = moveHistory.length - 1;
  const pos = moveHistory[idx]!;
  const p: Player = idx % 2 === 0 ? "X" : "O";
  const place = cellNameForPosition(pos);
  return `Latest move: ${p} just played at ${place} (cell ${pos}).`;
}
