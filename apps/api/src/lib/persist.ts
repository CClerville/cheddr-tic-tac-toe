import { and, eq, sql, type SQL } from "drizzle-orm";
import type { Redis } from "@upstash/redis";
import {
  computeElo,
  schema,
  type Database,
  type GameOutcome,
  type GamePersonality,
} from "@cheddr/db";
import type { AnalysisResponse } from "@cheddr/api-types";
import type { Difficulty, GameResult, Position } from "@cheddr/game-engine";

import { consumeEloBudget, setLeaderboardScore } from "./leaderboard.js";
import { Sentry } from "./sentry.js";

/** Normalize `db.execute()` across Neon HTTP (full result) and PGlite (`Results`). */
function rowsFromExecute(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows: unknown }).rows;
    if (Array.isArray(rows)) return rows as Record<string, unknown>[];
  }
  return [];
}

/**
 * Single-statement INSERT into `games` + UPDATE `users` for ranked terminal games.
 * Atomic on Postgres (Neon HTTP has no interactive transactions).
 */
async function insertRankedGameAndBumpUser(
  db: Database,
  input: PersistGameInput,
  outcome: GameOutcome,
  newElo: number,
  appliedDelta: number,
): Promise<{ id: string }> {
  const winsInc = outcome === "win" ? 1 : 0;
  const lossesInc = outcome === "loss" ? 1 : 0;
  const drawsInc = outcome === "draw" ? 1 : 0;

  const personalitySql: SQL =
    input.personality == null ? sql`NULL` : sql`${input.personality}`;
  const analysisSql: SQL =
    input.aiAnalysis == null
      ? sql`NULL`
      : sql`${JSON.stringify(input.aiAnalysis)}::jsonb`;

  const result = await db.execute(sql`
    WITH inserted AS (
      INSERT INTO games (
        user_id,
        difficulty,
        result,
        move_history,
        duration_ms,
        elo_delta,
        ranked,
        personality,
        ai_analysis
      )
      VALUES (
        ${input.userId},
        ${input.difficulty},
        ${outcome},
        ${JSON.stringify(input.moveHistory)}::jsonb,
        ${input.durationMs},
        ${appliedDelta},
        true,
        ${personalitySql},
        ${analysisSql}
      )
      RETURNING id
    ),
    bumped AS (
      UPDATE users
      SET
        elo = ${newElo},
        games_played = games_played + 1,
        wins = wins + ${winsInc},
        losses = losses + ${lossesInc},
        draws = draws + ${drawsInc}
      WHERE id = ${input.userId}
      RETURNING id
    )
    SELECT id AS game_id FROM inserted
  `);

  const rows = rowsFromExecute(result);
  const gameId = rows[0]?.["game_id"];
  if (typeof gameId !== "string") {
    throw new Error("Failed to insert ranked game row (no game_id returned)");
  }
  return { id: gameId };
}

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
  /**
   * AI personality the human played against. Optional so older callers (and
   * tests) keep compiling, but new game routes always pass it through from
   * the session so per-personality aggregates can be queried.
   */
  personality?: GamePersonality | null;
  /** When set, stored alongside the new game row (e.g. post-game analysis). */
  aiAnalysis?: AnalysisResponse | null;
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
  /** Primary key of the inserted `games` row. */
  gameId: string;
}

/**
 * Persist a terminal game and update derived state:
 *   - Ranked: one SQL statement (CTE) — INSERT `games` + UPDATE `users` counters/ELO
 *   - Unranked: INSERT `games` only (ranked counters unchanged)
 *   - ZADD leaderboard (best-effort, Clerk-backed ranked only)
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

  // Ranked: one SQL statement (CTE) so INSERT + UPDATE stay atomic without
  // `db.transaction` (unsupported on `drizzle-orm/neon-http`). Unranked:
  // single INSERT only — already atomic.
  let inserted: { id: string } | undefined;
  if (input.ranked) {
    inserted = await insertRankedGameAndBumpUser(
      db,
      input,
      outcome,
      newElo,
      appliedDelta,
    );
  } else {
    const [row] = await db
      .insert(schema.games)
      .values({
        userId: input.userId,
        difficulty: input.difficulty,
        result: outcome,
        moveHistory: input.moveHistory,
        durationMs: input.durationMs,
        eloDelta: appliedDelta,
        ranked: input.ranked,
        personality: input.personality ?? null,
        aiAnalysis: input.aiAnalysis ?? null,
      })
      .returning({ id: schema.games.id });
    inserted = row;
  }

  // The `users` aggregate counters (gamesPlayed/wins/losses/draws) and ELO
  // represent **ranked** progress only -- they feed the leaderboard and the
  // ranked-only "by difficulty" tile. Casual games are persisted to `games`
  // (so they show up in the per-difficulty / per-personality breakdowns)
  // but must NOT inflate the ranked counters. The full ranked + casual
  // breakdown is served separately via `GET /user/stats`.

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

  if (!inserted) {
    throw new Error("Failed to insert game row");
  }

  return { outcome, eloDelta: appliedDelta, newElo, gameId: inserted.id };
}

/**
 * Attach LLM analysis JSON to an existing game row. Scoped to `userId`
 * so users cannot mutate other players' history.
 */
export async function setGameAiAnalysis(
  db: Database,
  args: { gameId: string; userId: string; analysis: AnalysisResponse },
): Promise<boolean> {
  const updated = await db
    .update(schema.games)
    .set({ aiAnalysis: args.analysis })
    .where(
      and(eq(schema.games.id, args.gameId), eq(schema.games.userId, args.userId)),
    )
    .returning({ id: schema.games.id });
  return updated.length > 0;
}
