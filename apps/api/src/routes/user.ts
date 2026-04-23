import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import {
  type GameHistoryItem,
  type GamesListResponse,
  GamesListQuerySchema,
  type ModeStats,
  PersonalitySchema,
  type PersonalityKey,
  type Profile,
  ProfileUpdateRequestSchema,
  type ProfileUpdateResponse,
  SyncAnonRequestSchema,
  type SyncAnonResponse,
  type UserStatsResponse,
} from "@cheddr/api-types";
import { schema, type GameOutcome } from "@cheddr/db";
import type { Difficulty } from "@cheddr/game-engine";
import { z } from "zod";

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
/** Opaque cursor: last row's game id (keyset via pivot lookup). */
function encodeGameCursor(row: { id: string }): string {
  return row.id;
}

type ParsedGamesCursor =
  | { kind: "none" }
  | { kind: "legacy"; at: Date }
  | { kind: "composite"; at: Date; id: string }
  | { kind: "pivot"; id: string }
  | { kind: "invalid" };

function parseGamesCursor(cursor: string | undefined): ParsedGamesCursor {
  if (!cursor) return { kind: "none" };
  if (cursor.includes("|")) {
    const pipe = cursor.indexOf("|");
    const left = cursor.slice(0, pipe);
    const id = cursor.slice(pipe + 1);
    if (!z.string().uuid().safeParse(id).success) {
      return { kind: "invalid" };
    }
    const asMillis = Number(left);
    if (Number.isFinite(asMillis) && asMillis >= 0 && /^\d+$/.test(left)) {
      return { kind: "composite", at: new Date(asMillis), id };
    }
    const at = new Date(left);
    if (!Number.isFinite(at.getTime())) return { kind: "invalid" };
    return { kind: "composite", at, id };
  }
  if (z.string().uuid().safeParse(cursor).success) {
    return { kind: "pivot", id: cursor };
  }
  const at = new Date(cursor);
  if (!Number.isFinite(at.getTime())) return { kind: "invalid" };
  return { kind: "legacy", at };
}

function isUniqueViolation(err: unknown): boolean {
  const codes = new Set<string>();
  const messages: string[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 12 && cur; i++) {
    if (typeof cur === "object" && cur !== null) {
      const o = cur as Record<string, unknown>;
      if (typeof o.code === "string") codes.add(o.code);
      if (typeof o.message === "string") messages.push(o.message);
      cur = o.cause ?? o.originalError ?? null;
    } else {
      break;
    }
  }
  if (codes.has("23505")) return true;
  return messages.some(
    (m) =>
      /duplicate key|unique constraint|violates unique constraint/i.test(m),
  );
}

function emptyMode(): ModeStats {
  return { wins: 0, losses: 0, draws: 0, total: 0 };
}

function applyResultToMode(mode: ModeStats, result: GameOutcome, count: number) {
  if (result === "win") mode.wins += count;
  else if (result === "loss") mode.losses += count;
  else if (result === "draw") mode.draws += count;
  mode.total += count;
}

interface DifficultyAggRow {
  difficulty: Difficulty;
  ranked: boolean;
  result: GameOutcome;
  count: number;
}

interface PersonalityAggRow {
  personality: string | null;
  ranked: boolean;
  result: GameOutcome;
  count: number;
}

/**
 * Fold the two grouped scans into the wire response. Pure so it can be
 * exercised directly from tests without a DB.
 */
export function buildUserStatsResponse(
  difficultyRows: DifficultyAggRow[],
  personalityRows: PersonalityAggRow[],
): UserStatsResponse {
  const byDifficulty: UserStatsResponse["byDifficulty"] = {
    beginner: { ranked: emptyMode(), casual: emptyMode() },
    intermediate: { ranked: emptyMode(), casual: emptyMode() },
    expert: { ranked: emptyMode(), casual: emptyMode() },
  };

  for (const row of difficultyRows) {
    const tier = byDifficulty[row.difficulty];
    if (!tier) continue;
    const mode = row.ranked ? tier.ranked : tier.casual;
    applyResultToMode(mode, row.result, row.count);
  }

  const personalityMap = new Map<
    PersonalityKey,
    { ranked: ModeStats; casual: ModeStats }
  >();
  for (const row of personalityRows) {
    const key: PersonalityKey =
      row.personality !== null && PersonalitySchema.safeParse(row.personality).success
        ? (row.personality as PersonalityKey)
        : "unknown";
    let bucket = personalityMap.get(key);
    if (!bucket) {
      bucket = { ranked: emptyMode(), casual: emptyMode() };
      personalityMap.set(key, bucket);
    }
    const mode = row.ranked ? bucket.ranked : bucket.casual;
    applyResultToMode(mode, row.result, row.count);
  }

  // Stable, deterministic order: known personalities (in PersonalitySchema
  // order), then "unknown" last so it doesn't dominate the top of the list.
  const personalityOrder: PersonalityKey[] = [
    ...PersonalitySchema.options,
    "unknown",
  ];
  const byPersonality = personalityOrder
    .filter((key) => personalityMap.has(key))
    .map((key) => {
      const bucket = personalityMap.get(key)!;
      return { personality: key, ranked: bucket.ranked, casual: bucket.casual };
    });

  return { byDifficulty, byPersonality };
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

    /**
     * Aggregated breakdown of the signed-in user's full game history.
     *
     * The "Overview" / "By Difficulty" / "By Personality" tiles on the
     * profile screen all derive from this single response so the totals are
     * guaranteed to reconcile. Two grouped scans:
     *   1. (difficulty, ranked, result) -> `byDifficulty[tier].{ranked,casual}`
     *   2. (personality, ranked, result) -> `byPersonality[]`
     *
     * `personality IS NULL` rows (legacy games persisted before the column
     * existed) collapse into the synthetic `"unknown"` bucket.
     */
    .get("/stats", async (c) => {
      const identity = c.get("identity");

      const difficultyRows = await db
        .select({
          difficulty: schema.games.difficulty,
          ranked: schema.games.ranked,
          result: schema.games.result,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.games)
        .where(eq(schema.games.userId, identity.id))
        .groupBy(
          schema.games.difficulty,
          schema.games.ranked,
          schema.games.result,
        );

      const personalityRows = await db
        .select({
          personality: schema.games.personality,
          ranked: schema.games.ranked,
          result: schema.games.result,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.games)
        .where(eq(schema.games.userId, identity.id))
        .groupBy(
          schema.games.personality,
          schema.games.ranked,
          schema.games.result,
        );

      const body: UserStatsResponse = buildUserStatsResponse(
        difficultyRows,
        personalityRows,
      );
      return c.json(body);
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

      const parsed = parseGamesCursor(cursor);
      if (parsed.kind === "invalid") {
        throw new HTTPException(400, { message: "Invalid games cursor" });
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
          throw new HTTPException(400, { message: "Invalid games cursor" });
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
