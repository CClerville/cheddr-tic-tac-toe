import type { Difficulty } from "@cheddr/game-engine";
import type { GameOutcome } from "./schema";

/** K-factor for ELO updates. 32 is standard for new / casual players. */
export const ELO_K_FACTOR = 32;

/** Fixed ratings for the AI opponent at each difficulty. */
export const AI_RATINGS: Record<Difficulty, number> = {
  beginner: 800,
  intermediate: 1200,
  expert: 1800,
};

/** Floor to prevent ELO from going negative or absurdly low. */
export const MIN_ELO = 100;

export interface EloUpdate {
  playerElo: number;
  delta: number;
}

/**
 * Compute the next ELO rating for the human player after a game vs an AI of
 * a given difficulty. Uses the standard ELO formula with K = `ELO_K_FACTOR`.
 *
 * Outcome scoring is from the human's perspective:
 *   - `win`  => 1.0 (player forced AI into 3-in-a-row, AI lost)
 *   - `draw` => 0.5
 *   - `loss` => 0.0 (player completed 3-in-a-row, player lost)
 */
export function computeElo(
  currentElo: number,
  difficulty: Difficulty,
  outcome: GameOutcome,
): EloUpdate {
  const opponentRating = AI_RATINGS[difficulty];
  const expected = 1 / (1 + 10 ** ((opponentRating - currentElo) / 400));
  const score = outcome === "win" ? 1 : outcome === "draw" ? 0.5 : 0;

  const rawDelta = ELO_K_FACTOR * (score - expected);
  const delta = Math.round(rawDelta);

  const next = Math.max(MIN_ELO, currentElo + delta);
  return { playerElo: next, delta: next - currentElo };
}

/**
 * Anti-farming guard: cap the *positive* ELO change a single user can
 * accumulate per rolling hour. The caller (route handler) is responsible
 * for tracking the running total in Redis; this function clamps a single
 * delta against the remaining budget.
 */
export function clampDeltaToBudget(delta: number, remainingBudget: number): number {
  if (delta <= 0) return delta;
  if (remainingBudget <= 0) return 0;
  return Math.min(delta, remainingBudget);
}
