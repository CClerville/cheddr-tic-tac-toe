import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  AnonRequestSchema,
  type AnonResponse,
  type MeResponse,
} from "@cheddr/api-types";

import { mintAnonToken, newAnonUserId } from "../lib/anonToken";
import { auth, ensureUser } from "../middleware/auth";
import type { AppBindings, AppDeps } from "../types";

/**
 * Auth routes. Anonymous mint is unauthenticated (it's how a brand-new
 * device acquires its first identity). `/me` requires a valid token.
 */
export function createAuthRoutes(deps: AppDeps) {
  const { db, clerkSecretKey, jwtSecret } = deps;

  const requireAuth = auth({ db, clerkSecretKey, jwtSecret });

  return new Hono<AppBindings>()
    .post(
      "/anon",
      zValidator("json", AnonRequestSchema),
      async (c) => {
        // We don't strictly bind the JWT to deviceId today (the device sends
        // it back in the same payload on rotation), but we do log it so we
        // can audit churn / abuse. Future: bind via a `did` claim.
        const userId = newAnonUserId();
        await ensureUser(db, userId, "anon");
        const { token, expiresAt } = await mintAnonToken(jwtSecret, userId);
        const body: AnonResponse = { token, userId, expiresAt };
        return c.json(body);
      },
    )
    .get("/me", requireAuth, (c) => {
      const identity = c.get("identity");
      const body: MeResponse = { identity };
      return c.json(body);
    });
}
