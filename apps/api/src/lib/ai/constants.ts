/**
 * Centralized AI tunables. Keep these here rather than scattered through
 * `routes/ai.ts` so the budget surface is reviewable in one place.
 *
 * Reservations are deliberately *generous* upper bounds on what the
 * model can spend. The actual usage is reconciled in
 * `settleAiTokenReservation` after the call returns. Setting these too
 * low will reject legitimate requests; setting them too high lets a
 * single user burn through the global budget faster than expected.
 */

/** TTL on the per-user / global token counters (48h covers timezone drift). */
export const AI_TOKEN_COUNTER_TTL_SECONDS = 60 * 60 * 48;

/** Default per-user daily token ceiling (overridden by AI_DAILY_TOKEN_BUDGET env). */
export const DEFAULT_AI_DAILY_USER_TOKEN_BUDGET = 500_000;

/** Default global daily token ceiling (overridden by AI_GLOBAL_DAILY_TOKEN_BUDGET env). */
export const DEFAULT_AI_DAILY_GLOBAL_TOKEN_BUDGET = 20_000_000;

/**
 * Token reservations per AI route. These are pre-flight charges; final
 * settlement reconciles to actual usage from the model response.
 */
export const AI_TOKEN_RESERVE = {
  /** Short coach reaction stream after a move. */
  commentary: 200,
  /** Single-cell hint with reasoning + confidence. */
  hint: 250,
  /** Per-turn analysis covering the whole game. */
  analysis: 900,
} as const;

/** Output token caps passed to the model (kept slack-tight to control cost). */
export const AI_MAX_OUTPUT_TOKENS = {
  commentary: 120,
  hint: 200,
  analysis: 800,
} as const;
