import { Text, View } from "react-native";

import { GlassPanel } from "@/components/ui/GlassPanel";
import type {
  ModeStats,
  PersonalityKey,
  PersonalityStatsRow,
  UserStatsResponse,
} from "@cheddr/api-types";

const PERSONALITY_LABEL: Record<PersonalityKey, string> = {
  trash_talk: "Trash talk",
  coach: "Coach",
  zen_master: "Zen master",
  sports_caster: "Sports caster",
  unknown: "Unknown",
};

const PERSONALITY_HINT: Record<PersonalityKey, string> = {
  trash_talk: "Playful rival",
  coach: "Supportive tips",
  zen_master: "Calm focus",
  sports_caster: "Play-by-play",
  unknown: "Pre-personality games",
};

interface PersonalityBreakdownProps {
  serverStats: UserStatsResponse;
}

/**
 * Per-personality breakdown of game results (signed-in only).
 *
 * Each personality the user has played at least once gets a row with
 * Ranked + Casual splits side-by-side. Legacy games persisted before the
 * `games.personality` column existed surface in the `unknown` row at the
 * bottom and remain there until they age out (they never gain a label).
 */
export function PersonalityBreakdown({ serverStats }: PersonalityBreakdownProps) {
  const rows = serverStats.byPersonality.filter(
    (r) => r.ranked.total + r.casual.total > 0,
  );

  if (rows.length === 0) {
    return (
      <View className="gap-3">
        <Text className="text-xs text-muted dark:text-muted-dark text-center px-2">
          Play a game to see how Cheddr's personalities affect your results.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <Text className="text-xs text-muted dark:text-muted-dark text-center px-2">
        Ranked vs Casual splits per Cheddr personality
      </Text>
      {rows.map((row) => (
        <PersonalityRow key={row.personality} row={row} />
      ))}
    </View>
  );
}

function PersonalityRow({ row }: { row: PersonalityStatsRow }) {
  return (
    <View className="gap-2">
      <View className="px-1">
        <Text className="text-xs uppercase tracking-widest text-muted dark:text-muted-dark">
          {PERSONALITY_LABEL[row.personality]}
        </Text>
        <Text className="text-[10px] text-muted dark:text-muted-dark mt-0.5">
          {PERSONALITY_HINT[row.personality]}
        </Text>
      </View>
      <View className="flex-row gap-3">
        <ModeTile mode="Ranked" stats={row.ranked} />
        <ModeTile mode="Casual" stats={row.casual} />
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
