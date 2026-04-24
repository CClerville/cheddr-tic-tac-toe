import type { GameState, Player } from "./types";

/**
 * High-level phase a UI cares about. Derived purely from `GameState` so the
 * engine, the local hook, and the server-authoritative hook all agree on
 * the answer.
 *
 * - `hydrating`: only used by hooks that bootstrap async (no engine state yet).
 * - `player_turn`: human (X) is on move.
 * - `ai_thinking`: AI (O) is on move.
 * - `game_over`: terminal `result.status` (loss or draw).
 *
 * Keeping this here means a UI can never disagree with the engine about
 * what `result.status` means.
 */
export type GamePhase =
  | "hydrating"
  | "player_turn"
  | "ai_thinking"
  | "game_over";

/** Player constant the human controls. Mirrored from the engine convention. */
export const HUMAN_PLAYER: Player = "X";
/** Player constant the AI controls. */
export const AI_PLAYER: Player = "O";

/**
 * Map a `GameState` to its corresponding `GamePhase`.
 *
 * The function deliberately returns `player_turn` / `ai_thinking` rather
 * than echoing `currentPlayer` so the UI doesn't have to encode the
 * "X is the human" assumption in 5 different places.
 */
export function derivePhase(state: GameState): GamePhase {
  if (state.result.status !== "in_progress") return "game_over";
  return state.currentPlayer === HUMAN_PLAYER ? "player_turn" : "ai_thinking";
}
