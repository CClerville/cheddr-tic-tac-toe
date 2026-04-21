import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@cheddr/db";

import { createApp } from "../app";
import { createLeaderboardRoutes } from "../routes/leaderboard";
import { ensureUser } from "../middleware/auth";
import {
  LEADERBOARD_KEY,
  setLeaderboardScore,
} from "../lib/leaderboard";
import { rebuild } from "../scripts/rebuildLeaderboard";
import { createHarness } from "./harness";

async function build() {
  const harness = await createHarness();
  const app = createApp().route(
    "/leaderboard",
    createLeaderboardRoutes(harness.deps),
  );
  return { harness, app };
}

async function seedClerkUsers(
  harness: Awaited<ReturnType<typeof createHarness>>,
  entries: Array<{ id: string; username: string | null; elo: number }>,
) {
  for (const e of entries) {
    await ensureUser(harness.db, e.id, "clerk");
    await harness.db
      .update(schema.users)
      .set({ elo: e.elo, username: e.username })
      .where(eq(schema.users.id, e.id));
    await setLeaderboardScore(harness.deps.redis, e.id, e.elo);
  }
}

describe("GET /leaderboard/top", () => {
  it("returns ranked entries newest-first by ELO with usernames hydrated", async () => {
    const { harness, app } = await build();
    await seedClerkUsers(harness, [
      { id: "user_a", username: "alpha", elo: 1500 },
      { id: "user_b", username: "bravo", elo: 1200 },
      { id: "user_c", username: null, elo: 1800 },
    ]);

    const { token } = await harness.signInAnon();
    const res = await app.request("/leaderboard/top?limit=10", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entries: Array<{ userId: string; username: string | null; rank: number; elo: number }>;
      totalRanked: number;
    };

    expect(body.totalRanked).toBe(3);
    expect(body.entries.map((e) => e.userId)).toEqual(["user_c", "user_a", "user_b"]);
    expect(body.entries.map((e) => e.rank)).toEqual([1, 2, 3]);
    expect(body.entries[1].username).toBe("alpha");
    expect(body.entries[0].username).toBeNull();
  });

  it("respects the limit parameter", async () => {
    const { harness, app } = await build();
    await seedClerkUsers(harness, [
      { id: "u1", username: "u1", elo: 1100 },
      { id: "u2", username: "u2", elo: 1300 },
      { id: "u3", username: "u3", elo: 1200 },
    ]);

    const { token } = await harness.signInAnon();
    const res = await app.request("/leaderboard/top?limit=2", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { entries: unknown[] };
    expect(body.entries).toHaveLength(2);
  });
});

describe("GET /leaderboard/me", () => {
  it("returns null rank for anon callers but includes their ELO", async () => {
    const { harness, app } = await build();
    await seedClerkUsers(harness, [
      { id: "user_x", username: "X", elo: 1500 },
    ]);
    const { token } = await harness.signInAnon();
    const res = await app.request("/leaderboard/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rank: number | null;
      elo: number;
      neighbours: unknown[];
    };
    expect(body.rank).toBeNull();
    expect(body.neighbours).toHaveLength(0);
    expect(body.elo).toBe(1000);
  });
});

describe("rebuildLeaderboard", () => {
  it("backfills the leaderboard from Postgres truth", async () => {
    const { harness } = await build();
    await ensureUser(harness.db, "user_p1", "clerk");
    await ensureUser(harness.db, "user_p2", "clerk");
    await ensureUser(harness.db, `anon_${crypto.randomUUID()}`, "anon");
    await harness.db
      .update(schema.users)
      .set({ elo: 1500 })
      .where(eq(schema.users.id, "user_p1"));
    await harness.db
      .update(schema.users)
      .set({ elo: 1200 })
      .where(eq(schema.users.id, "user_p2"));

    expect(await harness.deps.redis.zcard(LEADERBOARD_KEY)).toBe(0);

    const inserted = await rebuild(harness.db, harness.deps.redis);
    expect(inserted).toBe(2);

    const total = await harness.deps.redis.zcard(LEADERBOARD_KEY);
    expect(total).toBe(2);
    const top = (await harness.deps.redis.zrange(LEADERBOARD_KEY, 0, -1, {
      rev: true,
    })) as string[];
    expect(top).toEqual(["user_p1", "user_p2"]);
  });
});
