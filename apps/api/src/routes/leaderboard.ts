import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, inArray } from "drizzle-orm";
import {
  type LeaderboardEntry,
  type LeaderboardMeResponse,
  LeaderboardTopQuerySchema,
  type LeaderboardTopResponse,
} from "@cheddr/api-types";
import { schema } from "@cheddr/db";

import { auth } from "../middleware/auth.js";
import { LEADERBOARD_KEY } from "../lib/leaderboard.js";
import type { AppBindings, AppDeps } from "../types.js";

export function createLeaderboardRoutes(deps: AppDeps) {
  const { db, redis, clerkSecretKey, jwtSecret } = deps;
  const requireAuth = auth({ db, clerkSecretKey, jwtSecret });

  return new Hono<AppBindings>()
    .use("*", requireAuth)

    .get("/top", zValidator("query", LeaderboardTopQuerySchema), async (c) => {
      const { limit } = c.req.valid("query");
      const raw = (await redis.zrange(LEADERBOARD_KEY, 0, limit - 1, {
        rev: true,
        withScores: true,
      })) as string[];
      const total = await redis.zcard(LEADERBOARD_KEY);

      const entries = await hydrateEntries(db, raw, 0);

      const body: LeaderboardTopResponse = { entries, totalRanked: total };
      return c.json(body);
    })

    .get("/me", async (c) => {
      const identity = c.get("identity");

      // Anon users are deliberately excluded from the leaderboard. We
      // still return their ELO so the UI can show a "sign in to rank"
      // affordance with a real number.
      if (identity.kind !== "clerk") {
        const body: LeaderboardMeResponse = {
          rank: null,
          elo: identity.elo,
          neighbours: [],
        };
        return c.json(body);
      }

      const rank = await redis.zrevrank(LEADERBOARD_KEY, identity.id);
      if (rank === null) {
        const body: LeaderboardMeResponse = {
          rank: null,
          elo: identity.elo,
          neighbours: [],
        };
        return c.json(body);
      }

      const start = Math.max(0, rank - 2);
      const stop = rank + 2;
      const raw = (await redis.zrange(LEADERBOARD_KEY, start, stop, {
        rev: true,
        withScores: true,
      })) as string[];
      const neighbours = await hydrateEntries(db, raw, start);

      const body: LeaderboardMeResponse = {
        rank: rank + 1,
        elo: identity.elo,
        neighbours,
      };
      return c.json(body);
    });
}

/**
 * Convert Upstash's `ZREVRANGE WITHSCORES` flat array into hydrated
 * leaderboard entries by joining against the `users` table for usernames.
 *
 * `startRank` is the zero-based rank of the first entry in `raw`; we add
 * it to the position-within-page to produce the absolute one-based `rank`.
 */
async function hydrateEntries(
  db: AppDeps["db"],
  raw: string[],
  startRank: number,
): Promise<LeaderboardEntry[]> {
  if (raw.length === 0) return [];
  const pairs: Array<{ id: string; elo: number }> = [];
  for (let i = 0; i < raw.length; i += 2) {
    pairs.push({ id: String(raw[i]), elo: Number(raw[i + 1]) });
  }
  const ids = pairs.map((p) => p.id);
  const rows = await db
    .select({ id: schema.users.id, username: schema.users.username })
    .from(schema.users)
    .where(inArray(schema.users.id, ids));
  const nameById = new Map(rows.map((r) => [r.id, r.username]));

  return pairs.map((p, i) => ({
    userId: p.id,
    username: nameById.get(p.id) ?? null,
    elo: p.elo,
    rank: startRank + i + 1,
  }));
}

void eq;
