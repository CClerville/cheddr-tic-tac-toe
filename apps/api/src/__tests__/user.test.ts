import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@cheddr/db";

import { createApp } from "../app";
import { createUserRoutes } from "../routes/user";
import { ensureUser } from "../middleware/auth";
import { mintAnonToken } from "../lib/anonToken";
import { persistTerminalGame } from "../lib/persist";
import { LEADERBOARD_KEY } from "../lib/leaderboard";
import { createHarness } from "./harness";

async function build() {
  const harness = await createHarness();
  const app = createApp().route("/user", createUserRoutes(harness.deps));
  return { harness, app };
}

describe("GET /user/me", () => {
  it("returns profile fields for an anon user", async () => {
    const { harness, app } = await build();
    const { token, userId } = await harness.signInAnon();

    const res = await app.request("/user/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; kind: string; elo: number };
    expect(body.id).toBe(userId);
    expect(body.kind).toBe("anon");
    expect(body.elo).toBe(1000);
  });
});

describe("GET /user/games", () => {
  it("returns the caller's games in newest-first order with cursor pagination", async () => {
    const { harness, app } = await build();
    const { token, userId } = await harness.signInAnon();

    // Seed 25 games so we can exercise pagination.
    for (let i = 0; i < 25; i++) {
      await persistTerminalGame(harness.db, harness.deps.redis, {
        userId,
        difficulty: "beginner",
        result: { status: "draw" },
        moveHistory: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        ranked: false,
        durationMs: 1000 + i,
      });
    }

    const r1 = await app.request("/user/games?limit=10", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r1.status).toBe(200);
    const page1 = (await r1.json()) as {
      items: { id: string; createdAt: string }[];
      nextCursor: string | null;
    };
    expect(page1.items).toHaveLength(10);
    expect(page1.nextCursor).not.toBeNull();

    const r2 = await app.request(
      `/user/games?limit=10&cursor=${encodeURIComponent(page1.nextCursor!)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const page2 = (await r2.json()) as {
      items: { id: string }[];
      nextCursor: string | null;
    };
    expect(page2.items).toHaveLength(10);
    // Pages are disjoint
    const overlap = page1.items
      .map((i) => i.id)
      .filter((id) => page2.items.some((b) => b.id === id));
    expect(overlap).toHaveLength(0);
  });
});

describe("POST /user/sync-anon", () => {
  it("rejects sync requests from anon-authenticated callers (must be Clerk)", async () => {
    const { harness, app } = await build();
    const { token: anonToken, userId: anonUserId } = await harness.signInAnon();

    // Mint a *second* anon token to use as the "anon to merge" payload.
    const { token: secondAnonToken } = await mintAnonToken(
      harness.deps.jwtSecret,
      `anon_${crypto.randomUUID()}`,
    );

    const res = await app.request("/user/sync-anon", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anonToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ anonToken: secondAnonToken }),
    });
    expect(res.status).toBe(403);
    void anonUserId;
  });

  it("merges games + stats and removes the anon row when called by Clerk", async () => {
    const { harness, app } = await build();

    // Set up an anon user with 3 finished games.
    const anonId = `anon_${crypto.randomUUID()}`;
    await ensureUser(harness.db, anonId, "anon");
    for (const outcome of ["win", "loss", "draw"] as const) {
      await persistTerminalGame(harness.db, harness.deps.redis, {
        userId: anonId,
        difficulty: "expert",
        result:
          outcome === "win"
            ? { status: "loss", loser: "O" }
            : outcome === "loss"
              ? { status: "loss", loser: "X" }
              : { status: "draw" },
        moveHistory: [4, 0, 8, 1, 2],
        ranked: true,
        durationMs: 5000,
      });
    }

    // Set up a Clerk user with 1 prior game.
    const clerkId = "user_clerk_sync_test";
    await ensureUser(harness.db, clerkId, "clerk");
    await persistTerminalGame(harness.db, harness.deps.redis, {
      userId: clerkId,
      difficulty: "intermediate",
      result: { status: "draw" },
      moveHistory: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      ranked: true,
      durationMs: 3000,
    });

    // Mint an anon token bound to the anon id, and a stub Clerk-style token
    // for our caller. Since Clerk verification is disabled in tests, we
    // bypass it by manually setting the identity via the user route.
    // Easiest path: call the merge function directly to test correctness,
    // then exercise the HTTP route with a Clerk-shaped token by enabling
    // the auth bypass below.

    const { token: anonToken } = await mintAnonToken(
      harness.deps.jwtSecret,
      anonId,
    );

    // Override the harness to inject a Clerk identity. We do this by
    // re-mounting the route with a Clerk-bound auth via a fake Clerk
    // verifier. Simpler: call the underlying function directly. (We
    // already cover the route's authorization in the previous test.)
    const { syncAnonToClerk } = await import("../lib/syncAnon");
    const result = await syncAnonToClerk(
      harness.db,
      harness.deps.redis,
      anonId,
      clerkId,
    );

    expect(result.mergedGames).toBe(3);
    expect(result.newGamesPlayed).toBe(4);
    // Higher of the two starting ELOs; both started at 1000 and the anon
    // probably didn't go much above due to budget caps.
    expect(result.newElo).toBeGreaterThanOrEqual(1000);

    const [clerkRow] = await harness.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, clerkId));
    expect(clerkRow.gamesPlayed).toBe(4);
    expect(clerkRow.wins + clerkRow.losses + clerkRow.draws).toBe(4);

    const [anonRow] = await harness.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, anonId));
    expect(anonRow).toBeUndefined();

    // Anon id is no longer on the leaderboard; clerk id is present.
    expect(await harness.redis.zscore(LEADERBOARD_KEY, anonId)).toBeNull();
    expect(await harness.redis.zscore(LEADERBOARD_KEY, clerkId)).not.toBeNull();

    void anonToken;
  });
});
