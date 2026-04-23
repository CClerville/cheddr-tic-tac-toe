import { useMemo } from "react";

import { useLocalGameStats } from "./useLocalGameStats";
import {
  totalAcrossDifficulties,
  useUserStats,
} from "./useUserStats";

export interface CombinedStats {
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
}

export interface UseCombinedStatsResult {
  /** What the home/profile "overall" cards should display. */
  combined: CombinedStats;
  /** Local-only (AsyncStorage) stats. Used for guest by-difficulty view. */
  local: CombinedStats;
  /** Server ranked stats — zeros when signed-out / loading. */
  ranked: CombinedStats;
  /** True until BOTH local and (if applicable) server stats have loaded. */
  loading: boolean;
  /** True while server stats are being fetched (useful for skeleton hints). */
  serverLoading: boolean;
  /** True when the signed-in user has any ranked games on file. */
  hasRanked: boolean;
}

const ZERO: CombinedStats = { wins: 0, losses: 0, draws: 0, totalGames: 0 };

/**
 * Single source of truth for "what should the overall stats card show?".
 *
 * Two distinct flows depending on auth:
 *   - Guest: server has nothing for them, so combined === local.
 *   - Signed-in: every game (ranked AND casual) is persisted server-side via
 *     /game/start, so combined === ranked + casual sums from {@link useUserStats}.
 *     Local AsyncStorage is intentionally ignored for signed-in users to avoid
 *     double-counting against the cross-device server source of truth.
 *
 * The ranked bucket is always derived from the server stats endpoint when
 * signed-in (single source — no longer pulls from `/user/me` here).
 */
export function useCombinedStats(): UseCombinedStatsResult {
  const { stats: local, loading: localLoading } = useLocalGameStats();
  const { data: serverStats, loading: serverLoading, enabled } = useUserStats();

  return useMemo(() => {
    const localBucket: CombinedStats = {
      wins: local.wins,
      losses: local.losses,
      draws: local.draws,
      totalGames: local.totalGames,
    };

    const rankedTotals = totalAcrossDifficulties(
      serverStats.byDifficulty,
      "ranked",
    );
    const casualTotals = totalAcrossDifficulties(
      serverStats.byDifficulty,
      "casual",
    );

    const rankedBucket: CombinedStats = enabled
      ? {
          wins: rankedTotals.wins,
          losses: rankedTotals.losses,
          draws: rankedTotals.draws,
          totalGames: rankedTotals.total,
        }
      : ZERO;

    const combined: CombinedStats = enabled
      ? {
          wins: rankedTotals.wins + casualTotals.wins,
          losses: rankedTotals.losses + casualTotals.losses,
          draws: rankedTotals.draws + casualTotals.draws,
          totalGames: rankedTotals.total + casualTotals.total,
        }
      : localBucket;

    return {
      combined,
      local: localBucket,
      ranked: rankedBucket,
      loading: enabled
        ? serverLoading
        : localLoading,
      serverLoading: enabled && serverLoading,
      hasRanked: rankedBucket.totalGames > 0,
    };
  }, [local, serverStats, localLoading, serverLoading, enabled]);
}
