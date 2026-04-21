import { z } from "zod";
import { DifficultySchema, GameOutcomeSchema, PositionSchema } from "./primitives";

export const ProfileSchema = z.object({
  id: z.string(),
  kind: z.enum(["clerk", "anon"]),
  username: z.string().nullable(),
  elo: z.number().int(),
  gamesPlayed: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
  draws: z.number().int(),
  createdAt: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const GameHistoryItemSchema = z.object({
  id: z.string().uuid(),
  difficulty: DifficultySchema,
  result: GameOutcomeSchema,
  moveHistory: z.array(PositionSchema),
  durationMs: z.number().int().nullable(),
  eloDelta: z.number().int(),
  ranked: z.boolean(),
  createdAt: z.string(),
});
export type GameHistoryItem = z.infer<typeof GameHistoryItemSchema>;

export const GamesListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().datetime().optional(),
});
export type GamesListQuery = z.infer<typeof GamesListQuerySchema>;

export const GamesListResponseSchema = z.object({
  items: z.array(GameHistoryItemSchema),
  nextCursor: z.string().datetime().nullable(),
});
export type GamesListResponse = z.infer<typeof GamesListResponseSchema>;

export const SyncAnonRequestSchema = z.object({
  /** The anon JWT issued previously; the server will verify and merge. */
  anonToken: z.string(),
});
export type SyncAnonRequest = z.infer<typeof SyncAnonRequestSchema>;

export const SyncAnonResponseSchema = z.object({
  mergedGames: z.number().int(),
  profile: ProfileSchema,
});
export type SyncAnonResponse = z.infer<typeof SyncAnonResponseSchema>;
