import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, lt, or } from "drizzle-orm";
import {
  type GameHistoryItem,
  type GamesListResponse,
  GamesListQuerySchema,
  ProfileUpdateRequestSchema,
  type ProfileUpdateResponse,
  SyncAnonRequestSchema,
} from "@cheddr/api-types";
import { schema, type UserRow } from "@cheddr/db";

import { apiError } from "../lib/errors.js";
import { auth } from "../middleware/auth.js";
import { isUniqueViolation, toProfile } from "../services/userProfile.js";
import {
  encodeGameCursor,
  fetchUserStatsForUser,
  parseGamesCursor,
} from "../services/userStats.js";
import { claimAnonHistoryForClerkUser } from "../services/userSync.js";
import type { AppBindings, AppDeps } from "../types.js";

export { buildUserStatsResponse } from "../services/userStats.js";
export type {
  DifficultyAggRow,
  PersonalityAggRow,
} from "../services/userStats.js";

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
        throw apiError("user_not_found", "User not found");
      }
      return c.json(toProfile(row));
    })

    .get("/stats", async (c) => {
      const identity = c.get("identity");
      const body = await fetchUserStatsForUser(db, identity.id);
      return c.json(body);
    })

    .patch(
      "/me",
      zValidator("json", ProfileUpdateRequestSchema),
      async (c) => {
        const identity = c.get("identity");

        if (identity.kind !== "clerk") {
          throw apiError("username_change_locked", "Sign in to edit your profile");
        }

        const update = c.req.valid("json");

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
            throw apiError("username_taken", "That username is already taken");
          }
          throw err;
        }

        if (!updated) {
          throw apiError("user_not_found", "User not found");
        }

        const body: ProfileUpdateResponse = { profile: toProfile(updated) };
        return c.json(body);
      },
    )

    .get("/games", zValidator("query", GamesListQuerySchema), async (c) => {
      const identity = c.get("identity");
      const { limit, cursor } = c.req.valid("query");

      const parsed = parseGamesCursor(cursor);
      if (parsed.kind === "invalid") {
        throw apiError("invalid_cursor", "Invalid games cursor");
      }

      const uid = eq(schema.games.userId, identity.id);
      let where;
      if (parsed.kind === "none") {
        where = uid;
      } else if (parsed.kind === "legacy") {
        where = and(uid, lt(schema.games.createdAt, parsed.at));
      } else if (parsed.kind === "composite") {
        where = and(
          uid,
          or(
            lt(schema.games.createdAt, parsed.at),
            and(
              eq(schema.games.createdAt, parsed.at),
              lt(schema.games.id, parsed.id),
            ),
          ),
        );
      } else {
        const [pivot] = await db
          .select({
            createdAt: schema.games.createdAt,
            id: schema.games.id,
          })
          .from(schema.games)
          .where(
            and(
              eq(schema.games.userId, identity.id),
              eq(schema.games.id, parsed.id),
            ),
          )
          .limit(1);
        if (!pivot) {
          throw apiError("invalid_cursor", "Invalid games cursor");
        }
        where = and(
          uid,
          or(
            lt(schema.games.createdAt, pivot.createdAt),
            and(
              eq(schema.games.createdAt, pivot.createdAt),
              lt(schema.games.id, pivot.id),
            ),
          ),
        );
      }

      const rows = await db
        .select()
        .from(schema.games)
        .where(where)
        .orderBy(desc(schema.games.createdAt), desc(schema.games.id))
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

      const lastRow = hasMore ? rows[limit - 1] : undefined;
      const body: GamesListResponse = {
        items,
        nextCursor:
          lastRow !== undefined ? encodeGameCursor(lastRow) : null,
      };
      return c.json(body);
    })

    .post("/sync-anon", zValidator("json", SyncAnonRequestSchema), async (c) => {
      const identity = c.get("identity");
      if (identity.kind !== "clerk") {
        throw apiError(
          "forbidden",
          "Only Clerk-authenticated users can claim an anon history",
        );
      }

      const { anonToken } = c.req.valid("json");
      const body = await claimAnonHistoryForClerkUser(
        { db, redis, jwtSecret },
        identity.id,
        anonToken,
      );
      return c.json(body);
    });
}
