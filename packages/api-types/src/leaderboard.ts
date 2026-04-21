import { z } from "zod";

export const LeaderboardEntrySchema = z.object({
  userId: z.string(),
  username: z.string().nullable(),
  elo: z.number().int(),
  rank: z.number().int().positive(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const LeaderboardTopQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type LeaderboardTopQuery = z.infer<typeof LeaderboardTopQuerySchema>;

export const LeaderboardTopResponseSchema = z.object({
  entries: z.array(LeaderboardEntrySchema),
  totalRanked: z.number().int().nonnegative(),
});
export type LeaderboardTopResponse = z.infer<typeof LeaderboardTopResponseSchema>;

export const LeaderboardMeResponseSchema = z.object({
  /** Null when the caller is anonymous (anon users are not ranked). */
  rank: z.number().int().positive().nullable(),
  elo: z.number().int(),
  /** A small window of neighbours, including the caller. Empty for anon. */
  neighbours: z.array(LeaderboardEntrySchema),
});
export type LeaderboardMeResponse = z.infer<typeof LeaderboardMeResponseSchema>;
