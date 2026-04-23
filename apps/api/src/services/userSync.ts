import { eq } from "drizzle-orm";
import type { SyncAnonResponse } from "@cheddr/api-types";
import { schema } from "@cheddr/db";

import { ensureUser } from "../middleware/auth.js";
import { verifyAnonToken } from "../lib/anonToken.js";
import { apiError } from "../lib/errors.js";
import { syncAnonToClerk } from "../lib/syncAnon.js";
import type { AppDeps } from "../types.js";
import { toProfile } from "./userProfile.js";

type SyncDeps = Pick<AppDeps, "db" | "redis" | "jwtSecret">;

/**
 * Merge anonymous game history into the signed-in Clerk user.
 * Caller must ensure `identity.kind === "clerk"` (403 otherwise belongs in route).
 */
export async function claimAnonHistoryForClerkUser(
  deps: SyncDeps,
  clerkUserId: string,
  anonToken: string,
): Promise<SyncAnonResponse> {
  let anonPayload;
  try {
    anonPayload = await verifyAnonToken(deps.jwtSecret, anonToken);
  } catch {
    throw apiError("invalid_anon_token", "Invalid anon token");
  }

  // Make sure the Clerk row exists (`auth` middleware already does this
  // for `c.get('identity').id`, but `ensureUser` is idempotent).
  await ensureUser(deps.db, clerkUserId, "clerk");

  const result = await syncAnonToClerk(
    deps.db,
    deps.redis,
    anonPayload.sub,
    clerkUserId,
  );

  const [row] = await deps.db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, clerkUserId))
    .limit(1);
  if (!row) {
    throw apiError("internal_error", "Clerk user disappeared mid-sync");
  }

  return {
    mergedGames: result.mergedGames,
    profile: toProfile(row),
  };
}
