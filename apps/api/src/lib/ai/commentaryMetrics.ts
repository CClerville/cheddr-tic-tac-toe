import type { Redis } from "@upstash/redis";

function utcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Daily counter when commentary text is replaced after spatial validation fails. */
export async function incrCommentaryHallucinationMetric(redis: Redis): Promise<void> {
  const key = `ai:commentary_hallucinations:${utcDateKey()}`;
  await redis.incrby(key, 1);
  await redis.expire(key, 86400 * 2);
}
