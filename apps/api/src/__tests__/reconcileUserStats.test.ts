import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@cheddr/db";

import { persistTerminalGame } from "../lib/persist.js";
import { reconcileUserRankedStats } from "../scripts/reconcileUserStats.js";
import { createHarness } from "./harness.js";

describe("reconcileUserRankedStats", () => {
  it("repairs drift between users row and ranked games aggregates", async () => {
    const harness = await createHarness();
    const { userId } = await harness.signInAnon();

    await persistTerminalGame(harness.db, harness.deps.redis, {
      userId,
      difficulty: "beginner",
      result: { status: "loss", loser: "O" },
      moveHistory: [4, 0, 1, 2, 3],
      ranked: true,
      durationMs: 100,
      personality: "coach",
    });

    await harness.db
      .update(schema.users)
      .set({ gamesPlayed: 0, wins: 0, losses: 0, draws: 0 })
      .where(eq(schema.users.id, userId));

    const result = await reconcileUserRankedStats(harness.db, { dryRun: false });
    expect(result.drifted).toBe(1);
    expect(result.updated).toBe(1);

    const [user] = await harness.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    expect(user?.gamesPlayed).toBe(1);
    expect(user?.wins).toBe(1);
  });

  it("dry-run reports drift without writing", async () => {
    const harness = await createHarness();
    const { userId } = await harness.signInAnon();

    await persistTerminalGame(harness.db, harness.deps.redis, {
      userId,
      difficulty: "beginner",
      result: { status: "loss", loser: "O" },
      moveHistory: [4, 0, 1, 2, 3],
      ranked: true,
      durationMs: 100,
    });

    await harness.db
      .update(schema.users)
      .set({ wins: 0, gamesPlayed: 0 })
      .where(eq(schema.users.id, userId));

    const result = await reconcileUserRankedStats(harness.db, { dryRun: true });
    expect(result.drifted).toBe(1);
    expect(result.updated).toBe(0);

    const [user] = await harness.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    expect(user?.wins).toBe(0);
    expect(user?.gamesPlayed).toBe(0);
  });

  it("never modifies elo", async () => {
    const harness = await createHarness();
    const { userId } = await harness.signInAnon();

    await persistTerminalGame(harness.db, harness.deps.redis, {
      userId,
      difficulty: "beginner",
      result: { status: "loss", loser: "O" },
      moveHistory: [4, 0, 1, 2, 3],
      ranked: true,
      durationMs: 100,
    });

    const arbitraryElo = 2345;
    await harness.db
      .update(schema.users)
      .set({
        elo: arbitraryElo,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      })
      .where(eq(schema.users.id, userId));

    await reconcileUserRankedStats(harness.db, { dryRun: false });

    const [user] = await harness.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    expect(user?.elo).toBe(arbitraryElo);
    expect(user?.gamesPlayed).toBe(1);
    expect(user?.wins).toBe(1);
  });

  it("no-op when users row already matches games", async () => {
    const harness = await createHarness();
    await harness.signInAnon();

    const result = await reconcileUserRankedStats(harness.db, { dryRun: false });
    expect(result.scanned).toBeGreaterThanOrEqual(1);
    expect(result.drifted).toBe(0);
    expect(result.updated).toBe(0);
  });
});
