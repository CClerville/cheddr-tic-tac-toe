import { Text, View } from "react-native";

import { GlassPanel } from "@/components/ui/GlassPanel";

export type CombinedStatsPanelVariant = "embedded" | "split";

export interface CombinedStatsPanelProps {
  wins: number;
  losses: number;
  draws: number;
  hasRanked: boolean;
  /**
   * `embedded` — three columns inside a parent panel (Home).
   * `split` — three glass tiles in a row (Profile Overview).
   */
  variant: CombinedStatsPanelVariant;
}

/**
 * Single rendering path for casual + ranked combined W/L/D and the caption
 * that disambiguates whether ranked play is included.
 */
export function CombinedStatsPanel({
  wins,
  losses,
  draws,
  hasRanked,
  variant,
}: CombinedStatsPanelProps) {
  const caption = hasRanked
    ? "Casual + ranked combined"
    : "Casual play";

  if (variant === "split") {
    return (
      <View className="gap-3">
        <View className="flex-row gap-3 justify-between">
          <SplitStatTile label="Wins" value={wins} />
          <SplitStatTile label="Losses" value={losses} />
          <SplitStatTile label="Draws" value={draws} />
        </View>
        <Text className="text-center text-[10px] uppercase tracking-wider text-muted dark:text-muted-dark">
          {caption}
        </Text>
      </View>
    );
  }

  return (
    <View className="py-4 px-2">
      <View className="flex-row justify-around">
        <EmbeddedStat label="Wins" value={wins} />
        <EmbeddedStat label="Losses" value={losses} />
        <EmbeddedStat label="Draws" value={draws} />
      </View>
      <Text className="text-center text-[10px] uppercase tracking-wider text-muted dark:text-muted-dark mt-3">
        {caption}
      </Text>
    </View>
  );
}

function EmbeddedStat({ label, value }: { label: string; value: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label.toLowerCase()}`}
      className="items-center"
    >
      <Text className="text-3xl font-bold text-primary dark:text-primary-dark">
        {value}
      </Text>
      <Text className="text-xs uppercase tracking-wider text-muted dark:text-muted-dark mt-1">
        {label}
      </Text>
    </View>
  );
}

function SplitStatTile({ label, value }: { label: string; value: number }) {
  return (
    <GlassPanel
      variant="panel"
      style={{ flex: 1 }}
      accessible
      accessibilityLabel={`${value} ${label.toLowerCase()}`}
    >
      <View className="py-4 px-2 items-center">
        <Text className="text-2xl font-bold text-primary dark:text-primary-dark">
          {value}
        </Text>
        <Text className="text-[10px] uppercase tracking-wider text-muted dark:text-muted-dark mt-1">
          {label}
        </Text>
      </View>
    </GlassPanel>
  );
}
