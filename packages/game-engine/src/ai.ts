import type { Board, CellValue, GameState, Player, Position } from "./types";
import { WIN_LINES, getValidMoves, checkResult } from "./rules";

function negamax(
  board: Board,
  player: Player,
  alpha: number,
  beta: number,
): number {
  const result = checkResult(board);

  if (result.status === "loss") {
    // The player who completed 3-in-a-row loses in Misere.
    // If the loser is the current player, that's bad (-1).
    // If the loser is the opponent, that's good (+1).
    return result.loser === player ? -1 : 1;
  }

  if (result.status === "draw") {
    return 0;
  }

  const moves = getValidMoves(board);
  let bestScore = -Infinity;

  for (const move of moves) {
    const newBoard = board.slice() as unknown as [
      CellValue, CellValue, CellValue,
      CellValue, CellValue, CellValue,
      CellValue, CellValue, CellValue,
    ];
    newBoard[move] = player;

    const opponent: Player = player === "X" ? "O" : "X";
    const score = -negamax(newBoard, opponent, -beta, -alpha);

    bestScore = Math.max(bestScore, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }

  return bestScore;
}

/** Optimal move for the current player (Misere-aware). Used by API hint fallback. */
export function getBestMove(state: GameState): Position {
  const moves = getValidMoves(state.board);
  let bestScore = -Infinity;
  let bestMove = moves[0];

  for (const move of moves) {
    const newBoard = state.board.slice() as unknown as [
      CellValue, CellValue, CellValue,
      CellValue, CellValue, CellValue,
      CellValue, CellValue, CellValue,
    ];
    newBoard[move] = state.currentPlayer;

    const opponent: Player = state.currentPlayer === "X" ? "O" : "X";
    const score = -negamax(newBoard, opponent, -Infinity, Infinity);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function getRandomMove(state: GameState): Position {
  const moves = getValidMoves(state.board);
  return moves[Math.floor(Math.random() * moves.length)];
}

export function getAiMove(state: GameState): Position {
  const moves = getValidMoves(state.board);
  if (moves.length === 0) {
    throw new Error("No valid moves available");
  }

  if (moves.length === 1) {
    return moves[0];
  }

  switch (state.difficulty) {
    case "beginner":
      return getRandomMove(state);

    case "intermediate":
      return Math.random() < 0.7 ? getBestMove(state) : getRandomMove(state);

    case "expert":
      return getBestMove(state);
  }
}
