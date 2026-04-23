import { describe, expect, it } from "vitest";

import { createFakeRedis } from "./fakeRedis.js";

describe("FakeRedis", () => {
  it("incrby preserves TTL when key already has ex", async () => {
    const r = createFakeRedis();
    await r.set("k", "0", { ex: 3600 });
    const n = await r.incrby("k", 5);
    expect(n).toBe(5);
    const ttlExtended = await r.expire("k", 3600);
    expect(ttlExtended).toBe(1);
  });

  it("zrange withScores returns flat member/score pairs", async () => {
    const r = createFakeRedis();
    await r.zadd("lb", { score: 10, member: "a" }, { score: 20, member: "b" });
    const flat = await r.zrange("lb", 0, -1, { withScores: true, rev: true });
    expect(flat).toEqual(["b", "20", "a", "10"]);
  });

  it("zrevrank returns null for missing member", async () => {
    const r = createFakeRedis();
    await r.zadd("lb", { score: 1, member: "only" });
    expect(await r.zrevrank("lb", "ghost")).toBeNull();
  });
});
