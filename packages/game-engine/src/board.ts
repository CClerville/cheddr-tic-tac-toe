import type { Board, Difficulty, GameState } from "./types";

export function createBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}

export function createGame(difficulty: Difficulty): GameState {
  return {
    board: createBoard(),
    currentPlayer: "X",
    moveHistory: [],
    result: { status: "in_progress" },
    difficulty,
  };
}
