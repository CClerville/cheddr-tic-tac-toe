import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";

import { apiGet } from "@/lib/api";
import { useAuthBootstrap } from "@/providers/AuthBootstrap";
import type { Profile } from "@cheddr/api-types";

import { useLocalGameStats } from "./useLocalGameStats";

export interface CombinedStats {
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
}

export interface UseCombinedStatsResult {
  /** Local (unranked) + server (ranked) totals merged. */
  combined: CombinedStats;
  /** Local-only stats (also exposed for the per-difficulty breakdown). */
  local: CombinedStats;
  /** Server-side ranked stats, or zeros when signed-out / loading. */
  ranked: CombinedStats;
  /** True until BOTH local and (if applicable) server stats have loaded. */
  loading: boolean;
  /** True when we're fetching server-side stats — useful for skeleton hints. */
  serverLoading: boolean;
  /** True if the signed-in user has any ranked games on file. */
  hasRanked: boolean;
}

const ZERO: CombinedStats = { wins: 0, losses: 0, draws: 0, totalGames: 0 };

/**
 * Single source of truth for "what should the home/stats overall card show?".
 *
 * Combines two storage backends:
 *   - Local AsyncStorage (unranked games — every user has these, including
 *     guests). Subscribes via the repository event emitter.
 *   - Server profile (ranked games — only for Clerk-authenticated users).
 *     Cached by react-query; the ranked-game hook invalidates this key on
 *     terminal results so the overview stays fresh.
 *
 * Anon JWT users intentionally do NOT contribute server counts here. The
 * `/user/me` endpoint returns the profile for the current bearer regardless
 * of kind, but we only count ranked play (Clerk-only) toward "Overall" to
 * mirror what the Profile screen displays. If we ever surface anon-user
 * server stats elsewhere, change `serverEnabled` here in one place.
 */
export function useCombinedStats(): UseCombinedStatsResult {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const { ready: authReady } = useAuthBootstrap();
  const { stats: local, loading: localLoading } = useLocalGameStats();

  const serverEnabled = isLoaded && authReady && !!isSignedIn && !!userId;

  const {
    data: profile,
    isLoading: serverLoading,
  } = useQuery<Profile>({
    // Match the profile screen's queryKey shape exactly so a single fetch
    // hydrates both screens and a single invalidation refreshes both.
    queryKey: ["user", "me", userId ?? "signed-out"],
    queryFn: () => apiGet<Profile>("/user/me"),
    enabled: serverEnabled,
  });

  return useMemo(() => {
    const localBucket: CombinedStats = {
      wins: local.wins,
      losses: local.losses,
      draws: local.draws,
      totalGames: local.totalGames,
    };

    const rankedBucket: CombinedStats = profile
      ? {
          wins: profile.wins,
          losses: profile.losses,
          draws: profile.draws,
          totalGames: profile.gamesPlayed,
        }
      : ZERO;

    const combined: CombinedStats = {
      wins: localBucket.wins + rankedBucket.wins,
      losses: localBucket.losses + rankedBucket.losses,
      draws: localBucket.draws + rankedBucket.draws,
      totalGames: localBucket.totalGames + rankedBucket.totalGames,
    };

    return {
      combined,
      local: localBucket,
      ranked: rankedBucket,
      // Loading state semantics: never block on the server fetch when the
      // user isn't signed in (server portion is permanently zero).
      loading: localLoading || (serverEnabled && serverLoading && !profile),
      serverLoading: serverEnabled && serverLoading,
      hasRanked: rankedBucket.totalGames > 0,
    };
  }, [local, profile, localLoading, serverEnabled, serverLoading]);
}
