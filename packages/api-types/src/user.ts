import { z } from "zod";
import { DifficultySchema, GameOutcomeSchema, PositionSchema } from "./primitives";

export const ProfileSchema = z.object({
  id: z.string(),
  kind: z.enum(["clerk", "anon"]),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  /** Hex color in `#RRGGBB` form, or null if not set. */
  avatarColor: z.string().nullable(),
  elo: z.number().int(),
  gamesPlayed: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
  draws: z.number().int(),
  createdAt: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

/**
 * Validation rules for editable profile fields. These are kept in the shared
 * api-types package so the mobile client and the API enforce identical
 * constraints — no "the server returned 422 with a message I can't render"
 * surprises. Any change here is a wire-format change.
 */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/i;
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const usernameSchema = z
  .string()
  .trim()
  .regex(
    USERNAME_PATTERN,
    "Username must be 3-20 chars, letters/numbers/underscore only",
  );

const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name cannot be empty")
  .max(50, "Display name must be 50 characters or fewer");

const avatarColorSchema = z
  .string()
  .trim()
  .regex(HEX_COLOR_PATTERN, "Avatar color must be a #RRGGBB hex string");

/**
 * PATCH /user/me request body. All fields are optional — the server applies
 * a partial update. `displayName` and `avatarColor` accept `null` to clear
 * the value; `username` cannot be cleared (it's required for ranked play).
 */
export const ProfileUpdateRequestSchema = z
  .object({
    username: usernameSchema.optional(),
    displayName: displayNameSchema.nullable().optional(),
    avatarColor: avatarColorSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (val) =>
      val.username !== undefined ||
      val.displayName !== undefined ||
      val.avatarColor !== undefined,
    { message: "At least one field must be provided" },
  );
export type ProfileUpdateRequest = z.infer<typeof ProfileUpdateRequestSchema>;

export const ProfileUpdateResponseSchema = z.object({
  profile: ProfileSchema,
});
export type ProfileUpdateResponse = z.infer<typeof ProfileUpdateResponseSchema>;

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
  /**
   * Pagination cursor: last page's **game id** (UUID, recommended), legacy
   * ISO `createdAt`, or `millis|id` / `ISO|id` composite for older clients.
   */
  cursor: z.string().min(1).max(220).optional(),
});
export type GamesListQuery = z.infer<typeof GamesListQuerySchema>;

export const GamesListResponseSchema = z.object({
  items: z.array(GameHistoryItemSchema),
  nextCursor: z.string().nullable(),
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
