import type { Board, CellValue, GameResult, GameState, Player, Position } from "./types";

export const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export function getValidMoves(board: Board): Position[] {
  const moves: Position[] = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      moves.push(i as Position);
    }
  }
  return moves;
}

export function checkResult(board: Board): GameResult {
  for (const [a, b, c] of WIN_LINES) {
    const va: CellValue = board[a];
    if (va !== null && va === board[b] && va === board[c]) {
      return { status: "loss", loser: va as Player };
    }
  }

  if (board.every((cell) => cell !== null)) {
    return { status: "draw" };
  }

  return { status: "in_progress" };
}

export function makeMove(state: GameState, position: Position): GameState {
  if (position < 0 || position > 8) {
    throw new Error(`Invalid position: ${position}`);
  }

  if (state.result.status !== "in_progress") {
    throw new Error("Cannot make a move: game is over");
  }

  if (state.board[position] !== null) {
    throw new Error(`Cell ${position} is already occupied`);
  }

  const newBoard = state.board.slice() as unknown as [
    CellValue, CellValue, CellValue,
    CellValue, CellValue, CellValue,
    CellValue, CellValue, CellValue,
  ];
  newBoard[position] = state.currentPlayer;

  const result = checkResult(newBoard);
  const nextPlayer: Player = state.currentPlayer === "X" ? "O" : "X";

  return {
    board: newBoard,
    currentPlayer: nextPlayer,
    moveHistory: [...state.moveHistory, position],
    result,
    difficulty: state.difficulty,
  };
}
