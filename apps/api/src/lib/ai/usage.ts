import type { Redis } from "@upstash/redis";

function utcDayKey(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function tokenKey(userId: string): string {
  return `cheddr:ai:tokens:${userId}:${utcDayKey()}`;
}

const TTL_SECONDS = 60 * 60 * 48;

export async function getDailyTokenUsage(
  redis: Redis,
  userId: string,
): Promise<number> {
  const raw = await redis.get<string | number>(tokenKey(userId));
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return raw;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function incrementDailyTokenUsage(
  redis: Redis,
  userId: string,
  totalTokens: number,
): Promise<number> {
  if (totalTokens <= 0) return await getDailyTokenUsage(redis, userId);
  const key = tokenKey(userId);
  const next = await redis.incrby(key, totalTokens);
  await redis.expire(key, TTL_SECONDS);
  return next;
}
