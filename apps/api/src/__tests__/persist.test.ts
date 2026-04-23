import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@cheddr/db";

import { persistTerminalGame } from "../lib/persist.js";
import { createHarness } from "./harness.js";

describe("persistTerminalGame CTE path", () => {
  it("returns gameId matching the inserted games row and bumps ranked counters in one write", async () => {
    const harness = await createHarness();
    const { userId } = await harness.signInAnon();

    const out = await persistTerminalGame(harness.db, harness.deps.redis, {
      userId,
      difficulty: "beginner",
      result: { status: "loss", loser: "O" },
      moveHistory: [4, 0, 1, 2, 3],
      ranked: true,
      durationMs: 500,
      personality: "coach",
    });

    const [game] = await harness.db
      .select()
      .from(schema.games)
      .where(eq(schema.games.id, out.gameId))
      .limit(1);
    expect(game).toBeDefined();
    expect(game?.userId).toBe(userId);
    expect(game?.ranked).toBe(true);

    const [user] = await harness.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    expect(user?.gamesPlayed).toBe(1);
    expect(user?.wins).toBe(1);
  });

  it("persists unranked games without touching user ranked counters", async () => {
    const harness = await createHarness();
    const { userId } = await harness.signInAnon();

    const out = await persistTerminalGame(harness.db, harness.deps.redis, {
      userId,
      difficulty: "expert",
      result: { status: "loss", loser: "X" },
      moveHistory: [0, 1, 2, 3],
      ranked: false,
      durationMs: 100,
      personality: "zen_master",
    });

    const [game] = await harness.db
      .select()
      .from(schema.games)
      .where(eq(schema.games.id, out.gameId));
    expect(game?.ranked).toBe(false);

    const [user] = await harness.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    expect(user?.gamesPlayed).toBe(0);
    expect(user?.wins).toBe(0);
    expect(user?.losses).toBe(0);
    expect(user?.draws).toBe(0);
    expect(user?.elo).toBe(1000);
  });
});
