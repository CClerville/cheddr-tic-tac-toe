import type { Board, Player, Position } from "@cheddr/game-engine";

const cell = (v: Board[number]): string => {
  if (v === "X") return "X";
  if (v === "O") return "O";
  return ".";
};

/** ASCII board for LLM context (Misere rules described in system prompt). */
export function serializeBoard(board: Board): string {
  const rows = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
  ] as const;
  return rows
    .map((r) => r.map((i) => cell(board[i])).join(" "))
    .join("\n");
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
      return `${idx + 1}. ${label} (${p}) → cell ${pos}`;
    })
    .join("\n");
}
