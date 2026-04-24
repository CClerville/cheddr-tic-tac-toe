export type {
  Player,
  CellValue,
  Board,
  Position,
  Difficulty,
  GameResult,
  GameState,
} from "./types";

export { createBoard, createGame } from "./board";
export { makeMove, checkResult, getValidMoves, WIN_LINES } from "./rules";
export { getAiMove, getBestMove } from "./ai";
export { derivePhase, HUMAN_PLAYER, AI_PLAYER, type GamePhase } from "./phase";
export { dtoToEngine, type GameStateLike } from "./dto";
