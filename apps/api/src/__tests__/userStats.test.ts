import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@cheddr/db";
import type { UserStatsResponse } from "@cheddr/api-types";

import { createApp } from "../app.js";
import { createUserRoutes, buildUserStatsResponse } from "../routes/user.js";
import { persistTerminalGame } from "../lib/persist.js";
import { createHarness } from "./harness.js";

async function build() {
  const harness = await createHarness();
  const app = createApp().route("/user", createUserRoutes(harness.deps));
  return { harness, app };
}

describe("buildUserStatsResponse", () => {
  it("folds difficulty + ranked + result rows into the byDifficulty grid", () => {
    const body = buildUserStatsResponse(
      [
        { difficulty: "beginner", ranked: true, result: "win", count: 3 },
        { difficulty: "beginner", ranked: true, result: "loss", count: 1 },
        { difficulty: "beginner", ranked: false, result: "draw", count: 2 },
        { difficulty: "expert", ranked: false, result: "loss", count: 4 },
      ],
      [],
    );

    expect(body.byDifficulty.beginner.ranked).toEqual({
      wins: 3,
      losses: 1,
      draws: 0,
      total: 4,
    });
    expect(body.byDifficulty.beginner.casual).toEqual({
      wins: 0,
      losses: 0,
      draws: 2,
      total: 2,
    });
    expect(body.byDifficulty.expert.casual).toEqual({
      wins: 0,
      losses: 4,
      draws: 0,
      total: 4,
    });
    // Untouched difficulty stays at zero on both sides.
    expect(body.byDifficulty.intermediate.ranked.total).toBe(0);
    expect(body.byDifficulty.intermediate.casual.total).toBe(0);
  });

  it("buckets known personalities and collapses null/unknown into 'unknown'", () => {
    const body = buildUserStatsResponse(
      [],
      [
        { personality: "coach", ranked: true, result: "win", count: 2 },
        { personality: "coach", ranked: false, result: "draw", count: 1 },
        { personality: null, ranked: true, result: "loss", count: 5 },
        { personality: "not_a_real_personality", ranked: false, result: "win", count: 3 },
      ],
    );

    const coach = body.byPersonality.find((r) => r.personality === "coach");
    expect(coach).toBeDefined();
    expect(coach!.ranked).toEqual({ wins: 2, losses: 0, draws: 0, total: 2 });
    expect(coach!.casual).toEqual({ wins: 0, losses: 0, draws: 1, total: 1 });

    const unknown = body.byPersonality.find(
      (r) => r.personality === "unknown",
    );
    expect(unknown).toBeDefined();
    // null + invalid personality both fold into unknown.
    expect(unknown!.ranked).toEqual({ wins: 0, losses: 5, draws: 0, total: 5 });
    expect(unknown!.casual).toEqual({ wins: 3, losses: 0, draws: 0, total: 3 });

    // Personalities the user has never played do not appear at all.
    expect(
      body.byPersonality.some((r) => r.personality === "trash_talk"),
    ).toBe(false);

    // 'unknown' is always last.
    expect(body.byPersonality[body.byPersonality.length - 1]!.personality).toBe(
      "unknown",
    );
  });
});

describe("GET /user/stats", () => {
  it("returns zeros for a brand-new user", async () => {
    const { harness, app } = await build();
    const { token } = await harness.signInAnon();

    const res = await app.request("/user/stats", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as UserStatsResponse;
    expect(body.byDifficulty.beginner.ranked.total).toBe(0);
    expect(body.byDifficulty.expert.casual.total).toBe(0);
    expect(body.byPersonality).toEqual([]);
  });

  it("aggregates ranked + casual splits and personality rows", async () => {
    const { harness, app } = await build();
    const { token, userId } = await harness.signInAnon();

    // 2 ranked wins on beginner with personality coach.
    for (let i = 0; i < 2; i++) {
      await persistTerminalGame(harness.db, harness.deps.redis, {
        userId,
        difficulty: "beginner",
        result: { status: "loss", loser: "O" },
        moveHistory: [4, 0, 1, 2, 3],
        ranked: true,
        durationMs: 1000,
        personality: "coach",
      });
    }

    // 1 casual draw on expert with no personality (legacy row).
    await persistTerminalGame(harness.db, harness.deps.redis, {
      userId,
      difficulty: "expert",
      result: { status: "draw" },
      moveHistory: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      ranked: false,
      durationMs: 2000,
      personality: null,
    });

    // 1 casual loss on intermediate with personality zen_master.
    await persistTerminalGame(harness.db, harness.deps.redis, {
      userId,
      difficulty: "intermediate",
      result: { status: "loss", loser: "X" },
      moveHistory: [0, 1, 2, 3],
      ranked: false,
      durationMs: 3000,
      personality: "zen_master",
    });

    const res = await app.request("/user/stats", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as UserStatsResponse;

    expect(body.byDifficulty.beginner.ranked).toEqual({
      wins: 2,
      losses: 0,
      draws: 0,
      total: 2,
    });
    expect(body.byDifficulty.beginner.casual.total).toBe(0);
    expect(body.byDifficulty.expert.casual).toEqual({
      wins: 0,
      losses: 0,
      draws: 1,
      total: 1,
    });
    expect(body.byDifficulty.intermediate.casual).toEqual({
      wins: 0,
      losses: 1,
      draws: 0,
      total: 1,
    });

    const coach = body.byPersonality.find((r) => r.personality === "coach");
    expect(coach?.ranked.wins).toBe(2);

    const zen = body.byPersonality.find((r) => r.personality === "zen_master");
    expect(zen?.casual.losses).toBe(1);

    const unknown = body.byPersonality.find(
      (r) => r.personality === "unknown",
    );
    expect(unknown?.casual.draws).toBe(1);
  });

  it("scopes results to the calling user", async () => {
    const { harness, app } = await build();
    const { token: aToken, userId: aId } = await harness.signInAnon();
    const { token: bToken, userId: bId } = await harness.signInAnon();

    // User A: 1 ranked win.
    await persistTerminalGame(harness.db, harness.deps.redis, {
      userId: aId,
      difficulty: "beginner",
      result: { status: "loss", loser: "O" },
      moveHistory: [4, 0, 1, 2, 3],
      ranked: true,
      durationMs: 1000,
      personality: "coach",
    });

    // User B: 5 casual losses.
    for (let i = 0; i < 5; i++) {
      await persistTerminalGame(harness.db, harness.deps.redis, {
        userId: bId,
        difficulty: "expert",
        result: { status: "loss", loser: "X" },
        moveHistory: [0, 1, 2, 3],
        ranked: false,
        durationMs: 1000,
        personality: "trash_talk",
      });
    }

    const aRes = (await (
      await app.request("/user/stats", {
        headers: { Authorization: `Bearer ${aToken}` },
      })
    ).json()) as UserStatsResponse;
    const bRes = (await (
      await app.request("/user/stats", {
        headers: { Authorization: `Bearer ${bToken}` },
      })
    ).json()) as UserStatsResponse;

    expect(aRes.byDifficulty.beginner.ranked.total).toBe(1);
    expect(aRes.byDifficulty.expert.casual.total).toBe(0);

    expect(bRes.byDifficulty.beginner.ranked.total).toBe(0);
    expect(bRes.byDifficulty.expert.casual.total).toBe(5);
  });
});

describe("persistTerminalGame ranked vs casual aggregates", () => {
  it("does not bump user ELO/wins/losses for casual games", async () => {
    const { harness } = await build();
    const { userId } = await harness.signInAnon();

    // 3 casual losses -- the user row's aggregate counters should stay at 0
    // because casual play feeds the per-game stats endpoint only.
    for (let i = 0; i < 3; i++) {
      await persistTerminalGame(harness.db, harness.deps.redis, {
        userId,
        difficulty: "expert",
        result: { status: "loss", loser: "X" },
        moveHistory: [0, 1, 2, 3],
        ranked: false,
        durationMs: 1000,
        personality: "trash_talk",
      });
    }

    const [row] = await harness.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    expect(row.elo).toBe(1000);
    expect(row.gamesPlayed).toBe(0);
    expect(row.wins).toBe(0);
    expect(row.losses).toBe(0);
    expect(row.draws).toBe(0);

    // But the games rows themselves are persisted (so /user/stats can see them).
    const gameRows = await harness.db
      .select()
      .from(schema.games)
      .where(eq(schema.games.userId, userId));
    expect(gameRows).toHaveLength(3);
    expect(gameRows.every((g) => g.ranked === false)).toBe(true);
    expect(gameRows.every((g) => g.eloDelta === 0)).toBe(true);
    expect(gameRows.every((g) => g.personality === "trash_talk")).toBe(true);
  });

  it("does bump ELO/counters for ranked games", async () => {
    const { harness } = await build();
    const { userId } = await harness.signInAnon();

    await persistTerminalGame(harness.db, harness.deps.redis, {
      userId,
      difficulty: "beginner",
      result: { status: "loss", loser: "O" }, // human wins
      moveHistory: [4, 0, 1, 2, 3],
      ranked: true,
      durationMs: 1000,
      personality: "coach",
    });

    const [row] = await harness.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    expect(row.gamesPlayed).toBe(1);
    expect(row.wins).toBe(1);
    expect(row.elo).toBeGreaterThan(1000);
  });
});
