import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@cheddr/db";

import { syncAnonToClerk } from "../lib/syncAnon.js";
import { createHarness } from "./harness.js";
import { ensureUser } from "../middleware/auth.js";

describe("syncAnonToClerk", () => {
  it("keeps the higher ELO when anon is ahead", async () => {
    const harness = await createHarness();
    const anonId = `anon_${crypto.randomUUID()}`;
    const clerkId = `user_clerk_${crypto.randomUUID()}`;
    await ensureUser(harness.db, anonId, "anon");
    await ensureUser(harness.db, clerkId, "clerk");
    await harness.db
      .update(schema.users)
      .set({ elo: 1250 })
      .where(eq(schema.users.id, anonId));
    await harness.db
      .update(schema.users)
      .set({ elo: 1100 })
      .where(eq(schema.users.id, clerkId));

    const r = await syncAnonToClerk(
      harness.db,
      harness.deps.redis,
      anonId,
      clerkId,
    );
    expect(r.newElo).toBe(1250);
    const [clerk] = await harness.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, clerkId));
    expect(clerk?.elo).toBe(1250);
  });

  it("is a no-op when anon row is missing", async () => {
    const harness = await createHarness();
    const clerkId = `user_clerk_${crypto.randomUUID()}`;
    await ensureUser(harness.db, clerkId, "clerk");
    const missingAnon = `anon_${crypto.randomUUID()}`;

    const r = await syncAnonToClerk(
      harness.db,
      harness.deps.redis,
      missingAnon,
      clerkId,
    );
    expect(r.mergedGames).toBe(0);
    expect(r.newElo).toBe(1000);
  });

  it("second sync is idempotent after anon is deleted", async () => {
    const harness = await createHarness();
    const anonId = `anon_${crypto.randomUUID()}`;
    const clerkId = `user_clerk_${crypto.randomUUID()}`;
    await ensureUser(harness.db, anonId, "anon");
    await ensureUser(harness.db, clerkId, "clerk");

    const first = await syncAnonToClerk(
      harness.db,
      harness.deps.redis,
      anonId,
      clerkId,
    );
    expect(first.mergedGames).toBe(0);

    const second = await syncAnonToClerk(
      harness.db,
      harness.deps.redis,
      anonId,
      clerkId,
    );
    expect(second.mergedGames).toBe(0);
    expect(second.newElo).toBe(first.newElo);
  });
});
