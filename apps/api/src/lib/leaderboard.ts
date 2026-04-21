import type { Redis } from "@upstash/redis";

/** Global leaderboard sorted set key. */
export const LEADERBOARD_KEY = "leaderboard:global";

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
  const used = (await redis.get<number>(eloBudgetKey(userId))) ?? 0;
  const remaining = Math.max(0, HOURLY_ELO_BUDGET - Number(used));
  const grant = Math.min(remaining, delta);
  if (grant > 0) {
    const next = Number(used) + grant;
    await redis.set(eloBudgetKey(userId), next, { ex: 3600 });
  }
  return grant;
}
