import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";

import { apiGet } from "@/lib/api";
import { useAuthBootstrap } from "@/providers/AuthBootstrap";
import {
  UserStatsResponseSchema,
  type DifficultyModeStats,
  type ModeStats,
  type PersonalityKey,
  type PersonalityStatsRow,
  type UserStatsResponse,
} from "@cheddr/api-types";
import type { Difficulty } from "@cheddr/game-engine";

export const EMPTY_MODE: ModeStats = Object.freeze({
  wins: 0,
  losses: 0,
  draws: 0,
  total: 0,
}) as ModeStats;

export const EMPTY_DIFFICULTY_MODE: DifficultyModeStats = Object.freeze({
  ranked: EMPTY_MODE,
  casual: EMPTY_MODE,
}) as DifficultyModeStats;

export const EMPTY_USER_STATS: UserStatsResponse = Object.freeze({
  byDifficulty: Object.freeze({
    beginner: EMPTY_DIFFICULTY_MODE,
    intermediate: EMPTY_DIFFICULTY_MODE,
    expert: EMPTY_DIFFICULTY_MODE,
  }),
  byPersonality: [] as PersonalityStatsRow[],
}) as UserStatsResponse;

export interface UseUserStatsResult {
  /** The full server-side stats payload, or zeros when signed-out / loading. */
  data: UserStatsResponse;
  /** True only while a fetch is in flight AND we don't have cached data yet. */
  loading: boolean;
  /** True only when the user is eligible for server-side stats (signed in). */
  enabled: boolean;
  error: unknown;
}

/**
 * Server-authoritative breakdown of the signed-in user's games:
 *   - by difficulty x ranked/casual
 *   - by personality x ranked/casual (with `unknown` bucket for legacy rows)
 *
 * The endpoint is gated on Clerk auth: anonymous play does not pull this
 * — anon users see local stats only via {@link useLocalGameStats}.
 *
 * Cache key is shared with {@link useRankedGame} which invalidates it on
 * every terminal game (ranked OR casual), so the breakdown updates as
 * soon as the user returns to a stats screen.
 */
export function useUserStats(): UseUserStatsResult {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const { ready: authReady } = useAuthBootstrap();

  const enabled = isLoaded && authReady && !!isSignedIn && !!userId;

  const { data, isLoading, error } = useQuery<UserStatsResponse>({
    queryKey: ["user", "stats", userId ?? "signed-out"],
    queryFn: () => apiGet("/user/stats", UserStatsResponseSchema),
    enabled,
    // Stats are derived from immutable game rows; safe to cache aggressively
    // and rely on explicit invalidations from useRankedGame for freshness.
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: data ?? EMPTY_USER_STATS,
    loading: enabled && isLoading && !data,
    enabled,
    error,
  };
}

/** Convenience: collapse ranked + casual ModeStats into a single ModeStats. */
export function combineMode(a: ModeStats, b: ModeStats): ModeStats {
  return {
    wins: a.wins + b.wins,
    losses: a.losses + b.losses,
    draws: a.draws + b.draws,
    total: a.total + b.total,
  };
}

/** Convenience: total ModeStats across all difficulties for a given mode. */
export function totalAcrossDifficulties(
  byDifficulty: UserStatsResponse["byDifficulty"],
  mode: "ranked" | "casual",
): ModeStats {
  const order: Difficulty[] = ["beginner", "intermediate", "expert"];
  return order.reduce<ModeStats>(
    (acc, d) => combineMode(acc, byDifficulty[d][mode]),
    EMPTY_MODE,
  );
}

export type { PersonalityKey };
