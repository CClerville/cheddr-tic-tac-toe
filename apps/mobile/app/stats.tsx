import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PressableScale } from "@/components/PressableScale";
import { haptics } from "@/lib/haptics";
import {
  EMPTY_STATS,
  gameRepository,
  type GameStats,
} from "@/storage/gameRepository";
import type { Difficulty } from "@cheddr/game-engine";

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "expert"];

export default function StatsScreen() {
  const [stats, setStats] = useState<GameStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    gameRepository
      .loadStats()
      .then((s) => {
        if (cancelled) return;
        setStats(s);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reset = async () => {
    haptics.selectionChange();
    await gameRepository.resetStats();
    setStats(EMPTY_STATS);
  };

  const empty = stats.totalGames === 0;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="px-3 py-2"
        >
          <Text className="text-base text-accent dark:text-accent-dark">
            Back
          </Text>
        </Pressable>
        <Text className="text-base font-semibold text-primary dark:text-primary-dark">
          Stats
        </Text>
        <View className="w-12" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-secondary dark:text-secondary-dark">
            Loading…
          </Text>
        </View>
      ) : empty ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-2xl font-bold text-primary dark:text-primary-dark mb-2">
            No games yet
          </Text>
          <Text className="text-center text-secondary dark:text-secondary-dark mb-8">
            Play your first round and your record will appear here.
          </Text>
          <PressableScale
            onPress={() => router.replace("/setup")}
            accessibilityRole="button"
            accessibilityLabel="Play first game"
            className="bg-accent dark:bg-accent-dark px-8 py-3 rounded-full"
          >
            <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold">
              Play
            </Text>
          </PressableScale>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 24, gap: 24 }}>
          <View className="bg-elevated dark:bg-elevated-dark rounded-2xl p-6">
            <Text className="text-xs uppercase tracking-widest text-muted dark:text-muted-dark mb-3">
              Overall
            </Text>
            <View className="flex-row justify-around">
              <Stat label="Wins" value={stats.wins} />
              <Stat label="Losses" value={stats.losses} />
              <Stat label="Draws" value={stats.draws} />
            </View>
            <Text className="text-center text-xs text-muted dark:text-muted-dark mt-4">
              {stats.totalGames} total games
            </Text>
          </View>

          {DIFFICULTIES.map((d) => {
            const row = stats.byDifficulty[d];
            const total = row.wins + row.losses + row.draws;
            return (
              <View
                key={d}
                className="bg-elevated dark:bg-elevated-dark rounded-2xl p-6"
              >
                <Text className="text-xs uppercase tracking-widest text-muted dark:text-muted-dark mb-3 capitalize">
                  {d}
                </Text>
                <View className="flex-row justify-around">
                  <Stat label="Wins" value={row.wins} />
                  <Stat label="Losses" value={row.losses} />
                  <Stat label="Draws" value={row.draws} />
                </View>
                <Text className="text-center text-xs text-muted dark:text-muted-dark mt-4">
                  {total} games
                </Text>
              </View>
            );
          })}

          <PressableScale
            onPress={reset}
            accessibilityRole="button"
            accessibilityLabel="Reset stats"
            accessibilityHint="Permanently clears all stored statistics"
            className="border border-subtle dark:border-subtle-dark py-3 rounded-full items-center mt-2"
          >
            <Text className="text-danger dark:text-danger-dark font-medium">
              Reset Stats
            </Text>
          </PressableScale>
        </ScrollView>
      )}
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
