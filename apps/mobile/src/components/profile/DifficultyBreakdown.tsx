import { Text, View } from "react-native";

import { GlassPanel } from "@/components/ui/GlassPanel";
import type { GameStats } from "@/storage/gameRepository";
import type {
  DifficultyModeStats,
  ModeStats,
  UserStatsResponse,
} from "@cheddr/api-types";
import type { Difficulty } from "@cheddr/game-engine";

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "expert"];

interface DifficultyBreakdownProps {
  /** When provided, render two tiles per difficulty (ranked + casual). */
  serverStats?: UserStatsResponse;
  /** Local-only fallback used when serverStats is omitted (guest users). */
  localStats?: GameStats;
}

/**
 * Per-difficulty breakdown of game results.
 *
 * Two layouts in one component:
 *   - signed-in (serverStats): two tiles per difficulty showing ranked vs
 *     casual splits. Both buckets aggregate cross-device server-side data.
 *   - guest (localStats): a single tile per difficulty showing on-device
 *     casual play only.
 */
export function DifficultyBreakdown({
  serverStats,
  localStats,
}: DifficultyBreakdownProps) {
  if (serverStats) {
    return (
      <View className="gap-4">
        <Text className="text-xs text-muted dark:text-muted-dark text-center px-2">
          Ranked vs Casual splits — synced across all your devices
        </Text>
        {DIFFICULTIES.map((d) => (
          <DifficultyRow
            key={d}
            difficulty={d}
            modes={serverStats.byDifficulty[d]}
          />
        ))}
      </View>
    );
  }

  const stats = localStats;
  if (!stats) return null;

  return (
    <View className="gap-3">
      <Text className="text-xs text-muted dark:text-muted-dark text-center px-2">
        On this device — casual games by AI difficulty
      </Text>
      {DIFFICULTIES.map((d) => {
        const row = stats.byDifficulty[d];
        const total = row.wins + row.losses + row.draws;
        return (
          <GlassPanel key={d} variant="panel">
            <View className="p-5">
              <Text className="text-xs uppercase tracking-widest text-muted dark:text-muted-dark mb-3 capitalize">
                {d}
              </Text>
              <View className="flex-row justify-around">
                <MiniStat label="W" value={row.wins} />
                <MiniStat label="L" value={row.losses} />
                <MiniStat label="D" value={row.draws} />
              </View>
              <Text className="text-center text-xs text-muted dark:text-muted-dark mt-3">
                {total} games
              </Text>
            </View>
          </GlassPanel>
        );
      })}
    </View>
  );
}

function DifficultyRow({
  difficulty,
  modes,
}: {
  difficulty: Difficulty;
  modes: DifficultyModeStats;
}) {
  return (
    <View className="gap-2">
      <Text className="text-xs uppercase tracking-widest text-muted dark:text-muted-dark capitalize px-1">
        {difficulty}
      </Text>
      <View className="flex-row gap-3">
        <ModeTile mode="Ranked" stats={modes.ranked} />
        <ModeTile mode="Casual" stats={modes.casual} />
      </View>
    </View>
  );
}

function ModeTile({
  mode,
  stats,
}: {
  mode: "Ranked" | "Casual";
  stats: ModeStats;
}) {
  return (
    <GlassPanel variant="panel" style={{ flex: 1 }}>
      <View className="p-4">
        <Text className="text-[11px] uppercase tracking-widest text-muted dark:text-muted-dark mb-3">
          {mode}
        </Text>
        <View className="flex-row justify-around">
          <MiniStat label="W" value={stats.wins} />
          <MiniStat label="L" value={stats.losses} />
          <MiniStat label="D" value={stats.draws} />
        </View>
        <Text className="text-center text-[11px] text-muted dark:text-muted-dark mt-3">
          {stats.total} games
        </Text>
      </View>
    </GlassPanel>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <View className="items-center">
      <Text className="text-xl font-bold text-primary dark:text-primary-dark">
        {value}
      </Text>
      <Text className="text-xs text-muted dark:text-muted-dark">{label}</Text>
    </View>
  );
}
