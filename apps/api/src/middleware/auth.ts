import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { verifyToken } from "@clerk/backend";
import { schema, type Database } from "@cheddr/db";
import type { Identity } from "@cheddr/api-types";

import { verifyAnonToken } from "../lib/anonToken.js";
import type { AppBindings } from "../types.js";

export interface AuthMiddlewareOptions {
  db: Database;
  /** When null, Clerk verification is skipped and only anon tokens are accepted. */
  clerkSecretKey: string | null;
  jwtSecret: string;
}

/**
 * Extract a bearer token, verify it (Clerk JWT first, then HS256 anon
 * fallback), and attach the resolved identity to the request context.
 *
 * On success, ensures a `users` row exists for the authenticated principal
 * (lazy-create for both Clerk and anon). Returns 401 on any failure.
 */
export function auth(options: AuthMiddlewareOptions): MiddlewareHandler<AppBindings> {
  const { db, clerkSecretKey, jwtSecret } = options;
  return async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header || !header.startsWith("Bearer ")) {
      throw new HTTPException(401, { message: "Missing bearer token" });
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new HTTPException(401, { message: "Empty bearer token" });
    }

    const identity = await resolveIdentity({ token, db, clerkSecretKey, jwtSecret });
    if (!identity) {
      throw new HTTPException(401, { message: "Invalid or expired token" });
    }

    c.set("identity", identity);
    await next();
  };
}

async function resolveIdentity(args: {
  token: string;
  db: Database;
  clerkSecretKey: string | null;
  jwtSecret: string;
}): Promise<Identity | null> {
  const { token, db, clerkSecretKey, jwtSecret } = args;

  // Try Clerk first. Anon tokens never validate against Clerk's JWKS, so
  // the failure is fast.
  if (clerkSecretKey) {
    try {
      const claims = await verifyToken(token, { secretKey: clerkSecretKey });
      const userId = claims.sub;
      if (typeof userId === "string" && userId.length > 0) {
        const user = await ensureUser(db, userId, "clerk");
        return {
          kind: "clerk",
          id: user.id,
          username: user.username,
          elo: user.elo,
        };
      }
    } catch {
      // fall through to anon
    }
  }

  try {
    const payload = await verifyAnonToken(jwtSecret, token);
    const user = await ensureUser(db, payload.sub, "anon");
    return {
      kind: "anon",
      id: user.id,
      username: user.username,
      elo: user.elo,
    };
  } catch {
    return null;
  }
}

/**
 * Idempotent upsert: lazily create a `users` row on first sight. We use
 * `INSERT ... ON CONFLICT DO NOTHING` then `SELECT` so concurrent
 * requests for the same user don't race.
 */
export async function ensureUser(
  db: Database,
  id: string,
  kind: "clerk" | "anon",
) {
  await db
    .insert(schema.users)
    .values({ id, kind })
    .onConflictDoNothing({ target: schema.users.id });

  const [row] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);

  if (!row) {
    throw new Error(`Failed to ensure user ${id}`);
  }
  return row;
}
