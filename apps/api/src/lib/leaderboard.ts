import type { Redis } from "@upstash/redis";

/** Global leaderboard sorted set key. */
export const LEADERBOARD_KEY = "leaderboard:global";

/** A single member/score pair returned by Redis sorted-set range queries. */
export interface LeaderboardScorePair {
  readonly member: string;
  readonly score: number;
}

/**
 * Parse Redis's flat `[member, score, member, score, ...]` `ZRANGE WITHSCORES`
 * response into typed pairs. Throws on malformed input (odd length, non-coercible
 * score) so callers don't silently surface NaN ranks to clients.
 *
 * Upstash's TS types for `zrange(..., { withScores: true })` resolve to
 * `(string | number)[]`; this helper is the single place we do that decode.
 */
export function parseZrangeWithScores(raw: unknown): LeaderboardScorePair[] {
  if (!Array.isArray(raw)) {
    throw new TypeError("Expected ZRANGE WITHSCORES to return an array");
  }
  if (raw.length % 2 !== 0) {
    throw new TypeError(
      `ZRANGE WITHSCORES returned odd-length array (${raw.length})`,
    );
  }
  const out: LeaderboardScorePair[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const member = raw[i];
    const score = raw[i + 1];
    if (typeof member !== "string" && typeof member !== "number") {
      throw new TypeError(
        `ZRANGE WITHSCORES returned non-scalar member at index ${i}`,
      );
    }
    const scoreNum = typeof score === "number" ? score : Number(score);
    if (!Number.isFinite(scoreNum)) {
      throw new TypeError(
        `ZRANGE WITHSCORES returned non-finite score at index ${i + 1}: ${String(score)}`,
      );
    }
    out.push({ member: String(member), score: scoreNum });
  }
  return out;
}

/** Per-user hourly ELO budget tracker key. */
const eloBudgetKey = (userId: string) => `elo:budget:${userId}`;

/** Maximum positive ELO a user can accrue per rolling hour. */
export const HOURLY_ELO_BUDGET = 50;

export async function setLeaderboardScore(
  redis: Redis,
  userId: string,
  elo: number,
): Promise<void> {
  await redis.zadd(LEADERBOARD_KEY, { score: elo, member: userId });
}

export async function removeFromLeaderboard(
  redis: Redis,
  userId: string,
): Promise<void> {
  await redis.zrem(LEADERBOARD_KEY, userId);
}

/**
 * Increment the user's hourly ELO-gain budget tracker and return the
 * remaining budget *before* this delta was applied. Caller should clamp
 * the actual ELO delta against the returned remaining budget.
 *
 * Implementation: a per-user counter that expires after 1 hour. When a
 * user gains ELO we increment the counter; when the counter exceeds
 * `HOURLY_ELO_BUDGET` we clamp future gains to zero until the window
 * resets.
 */
export async function consumeEloBudget(
  redis: Redis,
  userId: string,
  delta: number,
): Promise<number> {
  if (delta <= 0) return delta;
  const key = eloBudgetKey(userId);
  const nextTotal = await redis.incrby(key, delta);
  if (nextTotal === delta) {
    await redis.expire(key, 3600);
  }
  const overshoot = Math.max(0, nextTotal - HOURLY_ELO_BUDGET);
  if (overshoot > 0) {
    await redis.incrby(key, -overshoot);
  }
  return Math.max(0, delta - overshoot);
}
