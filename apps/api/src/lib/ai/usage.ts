import type { Redis } from "@upstash/redis";

import { getEnv } from "../../env.js";

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

function globalTokenKey(): string {
  return `cheddr:ai:tokens:global:${utcDayKey()}`;
}

const TTL_SECONDS = 60 * 60 * 48;

export function dailyTokenBudget(): number {
  return getEnv().AI_DAILY_TOKEN_BUDGET ?? 500_000;
}

export function globalDailyTokenBudget(): number {
  return getEnv().AI_GLOBAL_DAILY_TOKEN_BUDGET ?? 20_000_000;
}

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

/**
 * Atomically reserve `reserve` tokens against both the per-user and global
 * daily ceilings. Call `settleAiTokenReservation` after the model returns
 * to reconcile actual vs reserved usage.
 */
export async function tryReserveAiTokens(
  redis: Redis,
  userId: string,
  reserve: number,
  userBudget: number,
  globalBudget: number,
): Promise<
  { ok: true; reserved: number } | { ok: false; reason: "user" | "global" }
> {
  if (reserve <= 0) return { ok: true, reserved: 0 };
  const uKey = tokenKey(userId);
  const gKey = globalTokenKey();

  const userAfter = await redis.incrby(uKey, reserve);
  if (userAfter === reserve) await redis.expire(uKey, TTL_SECONDS);

  if (userAfter > userBudget) {
    await redis.incrby(uKey, -reserve);
    return { ok: false, reason: "user" };
  }

  const gAfter = await redis.incrby(gKey, reserve);
  if (gAfter === reserve) await redis.expire(gKey, TTL_SECONDS);

  if (gAfter > globalBudget) {
    await redis.incrby(uKey, -reserve);
    await redis.incrby(gKey, -reserve);
    return { ok: false, reason: "global" };
  }

  return { ok: true, reserved: reserve };
}

/**
 * Adjust counters after a call: `actual` tokens were consumed; `reserved`
 * was pre-charged via `tryReserveAiTokens`.
 */
export async function settleAiTokenReservation(
  redis: Redis,
  userId: string,
  reserved: number,
  actual: number,
): Promise<void> {
  const delta = actual - reserved;
  if (delta !== 0) {
    await redis.incrby(tokenKey(userId), delta);
    await redis.incrby(globalTokenKey(), delta);
  }
  await redis.expire(tokenKey(userId), TTL_SECONDS);
  await redis.expire(globalTokenKey(), TTL_SECONDS);
}
