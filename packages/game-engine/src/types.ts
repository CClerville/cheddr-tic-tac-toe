export type Player = "X" | "O";
export type CellValue = Player | null;

export type Board = readonly [
  CellValue,
  CellValue,
  CellValue,
  CellValue,
  CellValue,
  CellValue,
  CellValue,
  CellValue,
  CellValue,
];

export type Position = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Difficulty = "beginner" | "intermediate" | "expert";

export type GameResult =
  | { status: "in_progress" }
  | { status: "loss"; loser: Player }
  | { status: "draw" };

export interface GameState {
  readonly board: Board;
  readonly currentPlayer: Player;
  readonly moveHistory: readonly Position[];
  readonly result: GameResult;
  readonly difficulty: Difficulty;
}
