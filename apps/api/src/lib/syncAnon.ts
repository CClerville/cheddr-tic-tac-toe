import { eq, sql } from "drizzle-orm";
import type { Redis } from "@upstash/redis";
import { schema, type Database } from "@cheddr/db";

import { LEADERBOARD_KEY, setLeaderboardScore } from "./leaderboard.js";

export interface SyncAnonResult {
  mergedGames: number;
  newGamesPlayed: number;
  newWins: number;
  newLosses: number;
  newDraws: number;
  newElo: number;
}

/**
 * Merge an anonymous user's history into a Clerk account.
 *
 * Strategy:
 *  1. Reassign every `games.user_id = anonId` to `clerkId`
 *  2. Recompute Clerk user's `(gamesPlayed, wins, losses, draws)` from the
 *     full `games` table (post-reassignment)
 *  3. Take the *higher* ELO of the two existing rows -- the Clerk user
 *     should never lose progress by signing in
 *  4. Delete the now-orphan anon row
 *  5. Drop the anon ID from the leaderboard sorted set; add the Clerk id
 *     with the merged ELO
 *
 * Runs as sequential statements rather than a single transaction:
 * `drizzle-orm/neon-http` (our production driver) does NOT support
 * interactive transactions and throws on `db.transaction(...)`. Mid-merge
 * failure is recoverable by re-calling `syncAnonToClerk` — the
 * `games.userId` reassignment is idempotent, the user-row update is a
 * full overwrite, and the anon-row delete is a no-op once gone.
 */
export async function syncAnonToClerk(
  db: Database,
  redis: Redis,
  anonId: string,
  clerkId: string,
): Promise<SyncAnonResult> {
  if (!anonId.startsWith("anon_")) {
    throw new Error("syncAnonToClerk: anonId must start with anon_");
  }
  if (anonId === clerkId) {
    throw new Error("syncAnonToClerk: anonId and clerkId cannot be equal");
  }

  // Read both rows up-front so we can pick the higher ELO.
  const [anonRow] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, anonId))
    .limit(1);
  const [clerkRow] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, clerkId))
    .limit(1);

  if (!clerkRow) {
    throw new Error(`Clerk user ${clerkId} must exist before sync`);
  }
  if (!anonRow) {
    // Nothing to merge; idempotent no-op.
    return {
      mergedGames: 0,
      newGamesPlayed: clerkRow.gamesPlayed,
      newWins: clerkRow.wins,
      newLosses: clerkRow.losses,
      newDraws: clerkRow.draws,
      newElo: clerkRow.elo,
    };
  }

  const newElo = Math.max(clerkRow.elo, anonRow.elo);

  const mergedGamesQuery = await db
    .update(schema.games)
    .set({ userId: clerkId })
    .where(eq(schema.games.userId, anonId))
    .returning({ id: schema.games.id });

  const [aggregates] = await db
    .select({
      gamesPlayed: sql<number>`count(*)::int`,
      wins: sql<number>`sum(case when result = 'win' then 1 else 0 end)::int`,
      losses: sql<number>`sum(case when result = 'loss' then 1 else 0 end)::int`,
      draws: sql<number>`sum(case when result = 'draw' then 1 else 0 end)::int`,
    })
    .from(schema.games)
    .where(eq(schema.games.userId, clerkId));

  await db
    .update(schema.users)
    .set({
      elo: newElo,
      gamesPlayed: aggregates?.gamesPlayed ?? 0,
      wins: aggregates?.wins ?? 0,
      losses: aggregates?.losses ?? 0,
      draws: aggregates?.draws ?? 0,
    })
    .where(eq(schema.users.id, clerkId));

  await db.delete(schema.users).where(eq(schema.users.id, anonId));

  const mergedGames = mergedGamesQuery.length;

  // Best-effort leaderboard sync.
  try {
    await redis.zrem(LEADERBOARD_KEY, anonId);
    await setLeaderboardScore(redis, clerkId, newElo);
  } catch {
    // swallow; rebuild script can recover
  }

  return {
    mergedGames,
    newGamesPlayed: aggregates?.gamesPlayed ?? 0,
    newWins: aggregates?.wins ?? 0,
    newLosses: aggregates?.losses ?? 0,
    newDraws: aggregates?.draws ?? 0,
    newElo,
  };
}

