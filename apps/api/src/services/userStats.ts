import { eq, sql } from "drizzle-orm";
import {
  PersonalitySchema,
  type ModeStats,
  type PersonalityKey,
  type UserStatsResponse,
} from "@cheddr/api-types";
import { schema, type GameOutcome } from "@cheddr/db";
import type { Difficulty } from "@cheddr/game-engine";
import { z } from "zod";

import type { AppDeps } from "../types.js";

function emptyMode(): ModeStats {
  return { wins: 0, losses: 0, draws: 0, total: 0 };
}

function applyResultToMode(mode: ModeStats, result: GameOutcome, count: number) {
  if (result === "win") mode.wins += count;
  else if (result === "loss") mode.losses += count;
  else if (result === "draw") mode.draws += count;
  mode.total += count;
}

export interface DifficultyAggRow {
  difficulty: Difficulty;
  ranked: boolean;
  result: GameOutcome;
  count: number;
}

export interface PersonalityAggRow {
  personality: string | null;
  ranked: boolean;
  result: GameOutcome;
  count: number;
}

/**
 * Fold the two grouped scans into the wire response. Pure so it can be
 * exercised directly from tests without a DB.
 */
export function buildUserStatsResponse(
  difficultyRows: DifficultyAggRow[],
  personalityRows: PersonalityAggRow[],
): UserStatsResponse {
  const byDifficulty: UserStatsResponse["byDifficulty"] = {
    beginner: { ranked: emptyMode(), casual: emptyMode() },
    intermediate: { ranked: emptyMode(), casual: emptyMode() },
    expert: { ranked: emptyMode(), casual: emptyMode() },
  };

  for (const row of difficultyRows) {
    const tier = byDifficulty[row.difficulty];
    if (!tier) continue;
    const mode = row.ranked ? tier.ranked : tier.casual;
    applyResultToMode(mode, row.result, row.count);
  }

  const personalityMap = new Map<
    PersonalityKey,
    { ranked: ModeStats; casual: ModeStats }
  >();
  for (const row of personalityRows) {
    const key: PersonalityKey =
      row.personality !== null &&
      PersonalitySchema.safeParse(row.personality).success
        ? (row.personality as PersonalityKey)
        : "unknown";
    let bucket = personalityMap.get(key);
    if (!bucket) {
      bucket = { ranked: emptyMode(), casual: emptyMode() };
      personalityMap.set(key, bucket);
    }
    const mode = row.ranked ? bucket.ranked : bucket.casual;
    applyResultToMode(mode, row.result, row.count);
  }

  // Stable, deterministic order: known personalities (in PersonalitySchema
  // order), then "unknown" last so it doesn't dominate the top of the list.
  const personalityOrder: PersonalityKey[] = [
    ...PersonalitySchema.options,
    "unknown",
  ];
  const byPersonality = personalityOrder
    .filter((key) => personalityMap.has(key))
    .map((key) => {
      const bucket = personalityMap.get(key)!;
      return { personality: key, ranked: bucket.ranked, casual: bucket.casual };
    });

  return { byDifficulty, byPersonality };
}

/** Aggregated breakdown of a user's full game history for `/user/stats`. */
export async function fetchUserStatsForUser(
  db: AppDeps["db"],
  userId: string,
): Promise<UserStatsResponse> {
  const difficultyRows = await db
    .select({
      difficulty: schema.games.difficulty,
      ranked: schema.games.ranked,
      result: schema.games.result,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.games)
    .where(eq(schema.games.userId, userId))
    .groupBy(
      schema.games.difficulty,
      schema.games.ranked,
      schema.games.result,
    );

  const personalityRows = await db
    .select({
      personality: schema.games.personality,
      ranked: schema.games.ranked,
      result: schema.games.result,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.games)
    .where(eq(schema.games.userId, userId))
    .groupBy(
      schema.games.personality,
      schema.games.ranked,
      schema.games.result,
    );

  return buildUserStatsResponse(difficultyRows, personalityRows);
}

/** Opaque cursor: last row's game id (keyset via pivot lookup). */
export function encodeGameCursor(row: { id: string }): string {
  return row.id;
}

export type ParsedGamesCursor =
  | { kind: "none" }
  | { kind: "legacy"; at: Date }
  | { kind: "composite"; at: Date; id: string }
  | { kind: "pivot"; id: string }
  | { kind: "invalid" };

export function parseGamesCursor(cursor: string | undefined): ParsedGamesCursor {
  if (!cursor) return { kind: "none" };
  if (cursor.includes("|")) {
    const pipe = cursor.indexOf("|");
    const left = cursor.slice(0, pipe);
    const id = cursor.slice(pipe + 1);
    if (!z.string().uuid().safeParse(id).success) {
      return { kind: "invalid" };
    }
    const asMillis = Number(left);
    if (Number.isFinite(asMillis) && asMillis >= 0 && /^\d+$/.test(left)) {
      return { kind: "composite", at: new Date(asMillis), id };
    }
    const at = new Date(left);
    if (!Number.isFinite(at.getTime())) return { kind: "invalid" };
    return { kind: "composite", at, id };
  }
  if (z.string().uuid().safeParse(cursor).success) {
    return { kind: "pivot", id: cursor };
  }
  const at = new Date(cursor);
  if (!Number.isFinite(at.getTime())) return { kind: "invalid" };
  return { kind: "legacy", at };
}
