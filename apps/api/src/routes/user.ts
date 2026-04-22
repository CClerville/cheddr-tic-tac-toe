import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, lt } from "drizzle-orm";
import {
  type GameHistoryItem,
  type GamesListResponse,
  GamesListQuerySchema,
  type Profile,
  SyncAnonRequestSchema,
  type SyncAnonResponse,
} from "@cheddr/api-types";
import { schema } from "@cheddr/db";

import { auth, ensureUser } from "../middleware/auth.js";
import { verifyAnonToken } from "../lib/anonToken.js";
import { syncAnonToClerk } from "../lib/syncAnon.js";
import type { AppBindings, AppDeps } from "../types.js";

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
      const body: Profile = {
        id: row.id,
        kind: row.kind,
        username: row.username,
        elo: row.elo,
        gamesPlayed: row.gamesPlayed,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
        createdAt: row.createdAt.toISOString(),
      };
      return c.json(body);
    })

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
        profile: {
          id: row.id,
          kind: row.kind,
          username: row.username,
          elo: row.elo,
          gamesPlayed: row.gamesPlayed,
          wins: row.wins,
          losses: row.losses,
          draws: row.draws,
          createdAt: row.createdAt.toISOString(),
        },
      };
      return c.json(body);
    });
}
