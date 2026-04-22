import { eq, sql } from "drizzle-orm";
import type { Redis } from "@upstash/redis";
import {
  computeElo,
  schema,
  type Database,
  type GameOutcome,
} from "@cheddr/db";
import type { Difficulty, GameResult, Position } from "@cheddr/game-engine";

import { consumeEloBudget, setLeaderboardScore } from "./leaderboard.js";
import { Sentry } from "./sentry.js";

/**
 * Map a Misere `GameResult` into the human player's outcome. The human
 * always plays X; the AI plays O. A "loss" for X means the human player
 * lost (they completed 3-in-a-row). A "loss" for O means the AI lost.
 */
export function outcomeForPlayer(result: GameResult): GameOutcome {
  if (result.status === "draw") return "draw";
  if (result.status === "in_progress") {
    throw new Error("outcomeForPlayer called on in_progress state");
  }
  return result.loser === "X" ? "loss" : "win";
}

export interface PersistGameInput {
  userId: string;
  difficulty: Difficulty;
  result: GameResult;
  moveHistory: Position[];
  ranked: boolean;
  durationMs: number | null;
}

export interface PersistGameOutput {
  outcome: GameOutcome;
  /**
   * The applied ELO delta after the anti-farming budget has clamped any
   * positive gain. Zero for unranked games and for anonymous users (who
   * still play, but don't appear on the leaderboard).
   */
  eloDelta: number;
  newElo: number;
}

/**
 * Atomically persist a terminal game and update derived state:
 *   - INSERT into `games`
 *   - UPDATE `users` (elo, gamesPlayed, w/l/d)
 *   - ZADD leaderboard (only for Clerk-backed users)
 *
 * Returns the final outcome and ELO delta so the caller can echo it back
 * to the client in the move/resign response.
 */
export async function persistTerminalGame(
  db: Database,
  redis: Redis,
  input: PersistGameInput,
): Promise<PersistGameOutput> {
  const outcome = outcomeForPlayer(input.result);

  // Read the current ELO + kind so we can compute deltas and decide
  // whether to update the leaderboard.
  const [user] = await db
    .select({ elo: schema.users.elo, kind: schema.users.kind })
    .from(schema.users)
    .where(eq(schema.users.id, input.userId))
    .limit(1);

  if (!user) {
    throw new Error(`User ${input.userId} not found when persisting game`);
  }

  let appliedDelta = 0;
  let newElo = user.elo;

  if (input.ranked) {
    const { delta } = computeElo(user.elo, input.difficulty, outcome);
    appliedDelta = delta;
    if (delta > 0) {
      // Clamp positive gains against the user's hourly budget.
      appliedDelta = await consumeEloBudget(redis, input.userId, delta);
    }
    newElo = Math.max(100, user.elo + appliedDelta);
  }

  await db.insert(schema.games).values({
    userId: input.userId,
    difficulty: input.difficulty,
    result: outcome,
    moveHistory: input.moveHistory,
    durationMs: input.durationMs,
    eloDelta: appliedDelta,
    ranked: input.ranked,
  });

  await db
    .update(schema.users)
    .set({
      elo: newElo,
      gamesPlayed: sql`${schema.users.gamesPlayed} + 1`,
      wins: sql`${schema.users.wins} + ${outcome === "win" ? 1 : 0}`,
      losses: sql`${schema.users.losses} + ${outcome === "loss" ? 1 : 0}`,
      draws: sql`${schema.users.draws} + ${outcome === "draw" ? 1 : 0}`,
    })
    .where(eq(schema.users.id, input.userId));

  if (input.ranked && user.kind === "clerk") {
    // Best-effort: a leaderboard write failure should not poison the
    // game write itself. The leaderboard can be rebuilt from Postgres
    // (see `scripts/rebuild-leaderboard.ts` in slice 7).
    try {
      await setLeaderboardScore(redis, input.userId, newElo);
    } catch {
      // swallow
    }
  }

  Sentry.addBreadcrumb({
    category: "game.terminal",
    message: `game terminated: ${outcome}`,
    data: {
      userId: input.userId,
      difficulty: input.difficulty,
      ranked: input.ranked,
      moves: input.moveHistory.length,
      eloDelta: appliedDelta,
    },
    level: "info",
  });

  return { outcome, eloDelta: appliedDelta, newElo };
}
