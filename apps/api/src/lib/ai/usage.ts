import type { Redis } from "@upstash/redis";

import { getEnv } from "../../env.js";
import {
  AI_TOKEN_COUNTER_TTL_SECONDS,
  DEFAULT_AI_DAILY_GLOBAL_TOKEN_BUDGET,
  DEFAULT_AI_DAILY_USER_TOKEN_BUDGET,
} from "./constants.js";
import {
  RESERVE_AI_TOKENS_SCRIPT,
  type ReserveAiTokensResult,
} from "./luaScripts.js";

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

export function dailyTokenBudget(): number {
  return getEnv().AI_DAILY_TOKEN_BUDGET ?? DEFAULT_AI_DAILY_USER_TOKEN_BUDGET;
}

export function globalDailyTokenBudget(): number {
  return (
    getEnv().AI_GLOBAL_DAILY_TOKEN_BUDGET ??
    DEFAULT_AI_DAILY_GLOBAL_TOKEN_BUDGET
  );
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
 * daily ceilings via a single Redis EVAL. The script either increments both
 * counters or neither — there is no observable intermediate state, even
 * under concurrent requests.
 *
 * Call `settleAiTokenReservation` after the model returns to reconcile
 * actual vs reserved usage.
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

  const result = (await redis.eval(
    RESERVE_AI_TOKENS_SCRIPT,
    [uKey, gKey],
    [
      String(reserve),
      String(userBudget),
      String(globalBudget),
      String(AI_TOKEN_COUNTER_TTL_SECONDS),
    ],
  )) as ReserveAiTokensResult;

  const [ok, reason] = result;
  if (ok === 1) {
    return { ok: true, reserved: reserve };
  }
  // The script never returns "ok" with ok=0, so reason is "user" | "global".
  return { ok: false, reason: reason as "user" | "global" };
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
  await redis.expire(tokenKey(userId), AI_TOKEN_COUNTER_TTL_SECONDS);
  await redis.expire(globalTokenKey(), AI_TOKEN_COUNTER_TTL_SECONDS);
}
