import { useEffect, useState } from "react";
import {
  EMPTY_STATS,
  gameRepository,
  type GameRepository,
  type GameStats,
} from "@/storage/gameRepository";

export interface UseLocalGameStatsResult {
  stats: GameStats;
  /** True until the first read from storage completes. */
  loading: boolean;
  /** Force a re-read from storage (rare; subscription handles most cases). */
  refresh: () => Promise<void>;
}

/**
 * Subscribes to the local (unranked) stats stored on-device.
 *
 * Architecture:
 *   - Reads once on mount to seed state with whatever's persisted.
 *   - Subscribes to the repository's event emitter so writes propagate
 *     instantly to every mounted screen — no tab-focus polling required.
 *   - The subscription is the source of truth; the initial read just
 *     covers the gap before any write has occurred this session.
 */
export function useLocalGameStats(
  repository: GameRepository = gameRepository,
): UseLocalGameStatsResult {
  const [stats, setStats] = useState<GameStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const unsubscribe = repository.subscribe((next) => {
      if (!active) return;
      setStats(next);
    });

    void repository
      .loadStats()
      .then((initial) => {
        if (!active) return;
        setStats(initial);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [repository]);

  return {
    stats,
    loading,
    refresh: async () => {
      const next = await repository.loadStats();
      setStats(next);
    },
  };
}
