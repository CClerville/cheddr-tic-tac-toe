import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, lt } from "drizzle-orm";
import {
  type GameHistoryItem,
  type GamesListResponse,
  GamesListQuerySchema,
  type Profile,
  ProfileUpdateRequestSchema,
  type ProfileUpdateResponse,
  SyncAnonRequestSchema,
  type SyncAnonResponse,
} from "@cheddr/api-types";
import { schema } from "@cheddr/db";

import { auth, ensureUser } from "../middleware/auth.js";
import { verifyAnonToken } from "../lib/anonToken.js";
import { syncAnonToClerk } from "../lib/syncAnon.js";
import type { AppBindings, AppDeps } from "../types.js";

type UserRow = typeof schema.users.$inferSelect;

/** Project a `users` row into the public `Profile` wire type. */
function toProfile(row: UserRow): Profile {
  return {
    id: row.id,
    kind: row.kind,
    username: row.username,
    displayName: row.displayName,
    avatarColor: row.avatarColor,
    elo: row.elo,
    gamesPlayed: row.gamesPlayed,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Postgres surfaces unique-constraint violations as SQLSTATE 23505. The
 * serverless driver re-throws the original error with `.code` preserved,
 * but we also fall back to a substring match in case a wrapper rewrites
 * the shape.
 */
function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  if (code === "23505") return true;
  const msg = (err as { message?: unknown }).message;
  return typeof msg === "string" && msg.includes("users_username_unique");
}

export function createUserRoutes(deps: AppDeps) {
  const { db, redis, clerkSecretKey, jwtSecret } = deps;
  const requireAuth = auth({ db, clerkSecretKey, jwtSecret });

  return new Hono<AppBindings>()
    .use("*", requireAuth)

    .get("/me", async (c) => {
      const identity = c.get("identity");
      const [row] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, identity.id))
        .limit(1);
      if (!row) {
        throw new HTTPException(404, { message: "User not found" });
      }
      return c.json(toProfile(row));
    })

    .patch(
      "/me",
      zValidator("json", ProfileUpdateRequestSchema),
      async (c) => {
        const identity = c.get("identity");

        // Anon identities can play and rank locally, but profile editing
        // (which may surface on the leaderboard) is gated to Clerk users.
        if (identity.kind !== "clerk") {
          throw new HTTPException(403, {
            message: "Sign in to edit your profile",
          });
        }

        const update = c.req.valid("json");

        // Build the partial-update payload. We treat `undefined` as "leave
        // alone" and `null` (only valid for displayName/avatarColor) as
        // "clear". Drizzle's update() ignores undefined keys cleanly.
        const patch: Partial<{
          username: string;
          displayName: string | null;
          avatarColor: string | null;
        }> = {};
        if (update.username !== undefined) patch.username = update.username;
        if (update.displayName !== undefined)
          patch.displayName = update.displayName;
        if (update.avatarColor !== undefined)
          patch.avatarColor = update.avatarColor;

        let updated: UserRow | undefined;
        try {
          const rows = await db
            .update(schema.users)
            .set(patch)
            .where(eq(schema.users.id, identity.id))
            .returning();
          updated = rows[0];
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new HTTPException(409, {
              message: "That username is already taken",
            });
          }
          throw err;
        }

        if (!updated) {
          throw new HTTPException(404, { message: "User not found" });
        }

        const body: ProfileUpdateResponse = { profile: toProfile(updated) };
        return c.json(body);
      },
    )

    .get("/games", zValidator("query", GamesListQuerySchema), async (c) => {
      const identity = c.get("identity");
      const { limit, cursor } = c.req.valid("query");

      const where = cursor
        ? and(
            eq(schema.games.userId, identity.id),
            lt(schema.games.createdAt, new Date(cursor)),
          )
        : eq(schema.games.userId, identity.id);

      const rows = await db
        .select()
        .from(schema.games)
        .where(where)
        .orderBy(desc(schema.games.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items: GameHistoryItem[] = rows.slice(0, limit).map((r) => ({
        id: r.id,
        difficulty: r.difficulty,
        result: r.result,
        moveHistory: r.moveHistory,
        durationMs: r.durationMs,
        eloDelta: r.eloDelta,
        ranked: r.ranked,
        createdAt: r.createdAt.toISOString(),
      }));

      const body: GamesListResponse = {
        items,
        nextCursor: hasMore ? items[items.length - 1].createdAt : null,
      };
      return c.json(body);
    })

    .post("/sync-anon", zValidator("json", SyncAnonRequestSchema), async (c) => {
      const identity = c.get("identity");
      if (identity.kind !== "clerk") {
        throw new HTTPException(403, {
          message: "Only Clerk-authenticated users can claim an anon history",
        });
      }

      const { anonToken } = c.req.valid("json");
      let anonPayload;
      try {
        anonPayload = await verifyAnonToken(jwtSecret, anonToken);
      } catch {
        throw new HTTPException(400, { message: "Invalid anon token" });
      }

      // Make sure the Clerk row exists (`auth` middleware already does this
      // for `c.get('identity').id`, but `ensureUser` is idempotent).
      await ensureUser(db, identity.id, "clerk");

      const result = await syncAnonToClerk(
        db,
        redis,
        anonPayload.sub,
        identity.id,
      );

      const [row] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, identity.id))
        .limit(1);
      if (!row) {
        throw new HTTPException(500, {
          message: "Clerk user disappeared mid-sync",
        });
      }
      const body: SyncAnonResponse = {
        mergedGames: result.mergedGames,
        profile: toProfile(row),
      };
      return c.json(body);
    });
}
