import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { Difficulty, Position } from "@cheddr/game-engine";

export type UserKind = "clerk" | "anon";
export type GameOutcome = "win" | "loss" | "draw";

/**
 * `users` stores both signed-in (Clerk) accounts and anonymous device
 * identities. Anonymous IDs are prefixed (`anon_<uuid>`) so a sync from
 * anon -> Clerk is a transactional UPDATE of `games.user_id` and a DELETE
 * of the orphaned anon row -- no separate merge table needed.
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<UserKind>().notNull(),
  username: text("username").unique(),
  /** Optional human-readable name shown above the @username on the profile. */
  displayName: text("display_name"),
  /**
   * Hex color (e.g. `#F59E0B`) used as the avatar background when the user
   * has not uploaded an image. Stored as text so we are not locked into a
   * fixed palette — application-layer validation enforces `#RRGGBB`.
   */
  avatarColor: text("avatar_color"),
  elo: integer("elo").notNull().default(1000),
  gamesPlayed: integer("games_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    difficulty: text("difficulty").$type<Difficulty>().notNull(),
    result: text("result").$type<GameOutcome>().notNull(),
    moveHistory: jsonb("move_history").$type<Position[]>().notNull(),
    durationMs: integer("duration_ms"),
    eloDelta: integer("elo_delta").notNull().default(0),
    ranked: boolean("ranked").notNull().default(true),
    /** LLM post-game analysis JSON (`AnalysisResponse` from `@cheddr/api-types`). */
    aiAnalysis: jsonb("ai_analysis").$type<unknown>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("games_user_created_idx").on(
      t.userId,
      t.createdAt.desc(),
    ),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type GameRow = typeof games.$inferSelect;
export type NewGameRow = typeof games.$inferInsert;
