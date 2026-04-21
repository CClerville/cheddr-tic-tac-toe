import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PressableScale } from "@/components/PressableScale";
import { ThemeToggle } from "@/components/ThemeToggle";
import { haptics } from "@/lib/haptics";
import {
  EMPTY_STATS,
  gameRepository,
  type GameStats,
} from "@/storage/gameRepository";

export default function HomeScreen() {
  const [stats, setStats] = useState<GameStats>(EMPTY_STATS);

  useEffect(() => {
    let cancelled = false;
    gameRepository
      .loadStats()
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="flex-1 items-center justify-between px-6 py-10">
        <View className="items-center">
          <Text className="text-4xl font-bold text-primary dark:text-primary-dark tracking-tight">
            Cheddr
          </Text>
          <Text className="text-base text-secondary dark:text-secondary-dark mt-1">
            Misere Tic-Tac-Toe
          </Text>
        </View>

        <View className="items-center gap-3">
          <Text className="text-sm uppercase tracking-widest text-muted dark:text-muted-dark">
            Three-in-a-row loses
          </Text>
          <View className="flex-row gap-6 mt-2">
            <Stat label="Wins" value={stats.wins} />
            <Stat label="Losses" value={stats.losses} />
            <Stat label="Draws" value={stats.draws} />
          </View>
        </View>

        <View className="items-center gap-4 w-full">
          <PressableScale
            onPress={() => {
              haptics.selectionChange();
              router.push("/setup");
            }}
            accessibilityRole="button"
            accessibilityLabel="Play"
            accessibilityHint="Choose difficulty and start a new game"
            className="bg-accent dark:bg-accent-dark px-12 py-4 rounded-full w-full items-center"
          >
            <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold text-lg">
              Play
            </Text>
          </PressableScale>

          <PressableScale
            onPress={() => router.push("/stats")}
            accessibilityRole="button"
            accessibilityLabel="Stats"
            accessibilityHint="View detailed win/loss statistics"
            className="bg-elevated dark:bg-elevated-dark px-12 py-3 rounded-full w-full items-center"
          >
            <Text className="text-primary dark:text-primary-dark font-medium text-base">
              Stats
            </Text>
          </PressableScale>

          <ThemeToggle />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
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
