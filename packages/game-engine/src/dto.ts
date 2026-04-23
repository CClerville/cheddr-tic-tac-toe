import type {
  Board,
  CellValue,
  Difficulty,
  GameResult,
  GameState,
  Player,
  Position,
} from "./types";

/**
 * Loose structural shape we accept from the wire. Intentionally not
 * imported from `@cheddr/api-types` to keep the engine package
 * dependency-free; both sides agree on the shape via the primitives
 * defined here and Zod schemas defined there.
 *
 * Mutable arrays in / `readonly` tuples out: this is the only place
 * that boundary is crossed, and the cast lives here so engine consumers
 * never need to.
 */
export interface GameStateLike {
  readonly board: ReadonlyArray<CellValue>;
  readonly currentPlayer: Player;
  readonly moveHistory: ReadonlyArray<Position>;
  readonly result: GameResult;
  readonly difficulty: Difficulty;
}

/**
 * Map a wire-shaped DTO to the engine's strict `GameState`.
 *
 * Why this exists in the engine package: there were two near-identical
 * copies in the mobile app (`useGame`, `useRankedGame`) plus one in
 * tests. Centralizing it kills the drift risk where a new field is
 * added to one mapper and forgotten in the other.
 *
 * The `as Board` cast is safe because:
 *   1. `BoardSchema` on the wire validates a length-9 tuple.
 *   2. The engine's own contract guarantees `board.length === 9`.
 * If either invariant is ever violated we want a loud crash — which we
 * already get from the engine's `makeMove` invariants.
 */
export function dtoToEngine(dto: GameStateLike): GameState {
  return {
    board: [...dto.board] as unknown as Board,
    currentPlayer: dto.currentPlayer,
    moveHistory: [...dto.moveHistory],
    result: dto.result,
    difficulty: dto.difficulty,
  };
}
