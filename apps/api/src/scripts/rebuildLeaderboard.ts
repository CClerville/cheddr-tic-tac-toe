import { Redis } from "@upstash/redis";
import { createDb, schema } from "@cheddr/db";
import { eq } from "drizzle-orm";

import { LEADERBOARD_KEY } from "../lib/leaderboard.js";
import { getEnv, getRedisRest } from "../env.js";

/**
 * Rebuild the global leaderboard sorted set from Postgres truth.
 *
 * Use this when:
 *   - Redis was flushed or fell out of sync with Postgres
 *   - We want to backfill ranks for historical Clerk users
 *   - We change the leaderboard scoring rules and need to re-rank
 *
 * The rebuild is online-safe because:
 *   - We DEL then ZADD in batches, but live writes (game terminations)
 *     also do their own ZADD with the latest ELO; any race resolves to
 *     the most recent score.
 *   - Anon users are filtered out at the query level.
 *
 * Run: pnpm --filter @cheddr/api exec tsx src/scripts/rebuildLeaderboard.ts
 */
async function main(): Promise<void> {
  const env = getEnv();
  const redisRest = getRedisRest();
  if (!env.DATABASE_URL || !redisRest.url || !redisRest.token) {
    throw new Error("DATABASE_URL and Upstash Redis env vars are required");
  }

  const db = createDb(env.DATABASE_URL);
  const redis = new Redis({
    url: redisRest.url,
    token: redisRest.token,
  });

  await redis.del(LEADERBOARD_KEY);
  await rebuild(db, redis);
}

export async function rebuild(
  db: ReturnType<typeof createDb>,
  redis: Redis,
): Promise<number> {
  const rows = await db
    .select({
      id: schema.users.id,
      elo: schema.users.elo,
    })
    .from(schema.users)
    .where(eq(schema.users.kind, "clerk"));

  if (rows.length === 0) return 0;

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    if (batch.length === 0) continue;
    const [head, ...tail] = batch.map((r) => ({
      score: r.elo,
      member: r.id,
    }));
    await redis.zadd(LEADERBOARD_KEY, head, ...tail);
  }
  return rows.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      console.log("Leaderboard rebuilt");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Rebuild failed:", err);
      process.exit(1);
    });
}
