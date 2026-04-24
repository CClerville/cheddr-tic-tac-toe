import type { Redis } from "@upstash/redis";
import { describe, expect, it } from "vitest";

import {
  getDailyTokenUsage,
  settleAiTokenReservation,
  tryReserveAiTokens,
} from "../lib/ai/usage.js";
import { createFakeRedis, type FakeRedis } from "./fakeRedis.js";

/** The fake supports the eval shim used by tryReserveAiTokens. */
function makeRedis(): { fake: FakeRedis; redis: Redis } {
  const fake = createFakeRedis();
  return { fake, redis: fake as unknown as Redis };
}

describe("tryReserveAiTokens (Lua-backed atomic reservation)", () => {
  const userId = "user_test_atomic";
  const userBudget = 1_000;
  const globalBudget = 10_000;

  it("succeeds when there is headroom and increments both counters", async () => {
    const { redis, fake } = makeRedis();

    const result = await tryReserveAiTokens(
      redis,
      userId,
      250,
      userBudget,
      globalBudget,
    );

    expect(result).toEqual({ ok: true, reserved: 250 });
    expect(await getDailyTokenUsage(redis, userId)).toBe(250);
    // Global counter incremented atomically — find it in the dump.
    const dump = fake.__dump() as { kv: Record<string, { value: unknown }> };
    const globalEntry = Object.entries(dump.kv).find(([k]) =>
      k.includes(":global:"),
    );
    expect(globalEntry?.[1].value).toBe(250);
  });

  it("rejects with reason='user' when reserve exceeds user budget and writes nothing", async () => {
    const { redis } = makeRedis();

    const result = await tryReserveAiTokens(
      redis,
      userId,
      1_001,
      userBudget,
      globalBudget,
    );

    expect(result).toEqual({ ok: false, reason: "user" });
    expect(await getDailyTokenUsage(redis, userId)).toBe(0);
  });

  it("rejects with reason='global' when reserve exceeds global budget and writes nothing", async () => {
    const { redis } = makeRedis();

    const result = await tryReserveAiTokens(
      redis,
      userId,
      500,
      userBudget,
      400, // global lower than reserve
    );

    expect(result).toEqual({ ok: false, reason: "global" });
    expect(await getDailyTokenUsage(redis, userId)).toBe(0);
  });

  it("treats reserve <= 0 as a no-op (does not call Redis)", async () => {
    const { redis } = makeRedis();

    const result = await tryReserveAiTokens(
      redis,
      userId,
      0,
      userBudget,
      globalBudget,
    );

    expect(result).toEqual({ ok: true, reserved: 0 });
    expect(await getDailyTokenUsage(redis, userId)).toBe(0);
  });

  it("never overshoots the user budget under N concurrent requests", async () => {
    // 25 concurrent reservations of 50 tokens each against a 200 budget.
    // The naive non-atomic implementation lets several past the check;
    // the atomic Lua script must permit *exactly* floor(200/50) = 4.
    const { redis } = makeRedis();
    const reserve = 50;
    const tightUserBudget = 200;
    const concurrent = 25;

    const results = await Promise.all(
      Array.from({ length: concurrent }, () =>
        tryReserveAiTokens(redis, userId, reserve, tightUserBudget, globalBudget),
      ),
    );

    const accepted = results.filter((r) => r.ok).length;
    const rejected = results.filter((r) => !r.ok && r.reason === "user").length;

    expect(accepted).toBe(4);
    expect(rejected).toBe(concurrent - 4);
    expect(await getDailyTokenUsage(redis, userId)).toBe(reserve * accepted);
    expect(await getDailyTokenUsage(redis, userId)).toBeLessThanOrEqual(
      tightUserBudget,
    );
  });

  it("never overshoots the global budget under N concurrent requests across users", async () => {
    const { redis } = makeRedis();
    const reserve = 100;
    const tightGlobalBudget = 350;
    const concurrent = 20;

    const results = await Promise.all(
      Array.from({ length: concurrent }, (_, i) =>
        tryReserveAiTokens(
          redis,
          `user_${i}`,
          reserve,
          userBudget,
          tightGlobalBudget,
        ),
      ),
    );

    const accepted = results.filter((r) => r.ok).length;
    expect(accepted).toBe(3); // floor(350 / 100)
    expect(results.filter((r) => !r.ok && r.reason === "global").length).toBe(
      concurrent - accepted,
    );
  });

  it("settle() reconciles actual vs reserved after a successful reservation", async () => {
    const { redis } = makeRedis();
    await tryReserveAiTokens(redis, userId, 500, userBudget, globalBudget);
    expect(await getDailyTokenUsage(redis, userId)).toBe(500);

    // Reserved 500, actually used 380 → counter must end at 380.
    await settleAiTokenReservation(redis, userId, 500, 380);
    expect(await getDailyTokenUsage(redis, userId)).toBe(380);
  });
});
