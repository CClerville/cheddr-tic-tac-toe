import { router } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";

import { PressableScale } from "@/components/PressableScale";
import { apiGet } from "@/lib/api";
import type {
  LeaderboardEntry,
  LeaderboardMeResponse,
  LeaderboardTopResponse,
} from "@cheddr/api-types";

export default function LeaderboardScreen() {
  const { isSignedIn, isLoaded } = useAuth();

  const top = useQuery<LeaderboardTopResponse>({
    queryKey: ["leaderboard", "top"],
    queryFn: () => apiGet<LeaderboardTopResponse>("/leaderboard/top?limit=50"),
    enabled: isLoaded,
  });

  const me = useQuery<LeaderboardMeResponse>({
    queryKey: ["leaderboard", "me"],
    queryFn: () => apiGet<LeaderboardMeResponse>("/leaderboard/me"),
    enabled: isLoaded,
  });

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={() => router.back()} className="px-3 py-2">
          <Text className="text-base text-accent dark:text-accent-dark">
            Back
          </Text>
        </Pressable>
        <Text className="text-base font-semibold text-primary dark:text-primary-dark">
          Leaderboard
        </Text>
        <View className="w-12" />
      </View>

      {!isSignedIn ? (
        <View className="px-6 pb-3">
          <PressableScale
            onPress={() => router.push("/sign-in")}
            className="bg-accent dark:bg-accent-dark py-3 rounded-full items-center"
            accessibilityRole="button"
            accessibilityLabel="Sign in to appear on the leaderboard"
          >
            <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold">
              Sign in to appear on the leaderboard
            </Text>
          </PressableScale>
        </View>
      ) : me.data && me.data.rank !== null ? (
        <View className="px-6 pb-3">
          <Text className="text-secondary dark:text-secondary-dark">
            You are ranked{" "}
            <Text className="text-primary dark:text-primary-dark font-semibold">
              #{me.data.rank}
            </Text>{" "}
            with{" "}
            <Text className="text-primary dark:text-primary-dark font-semibold">
              {me.data.elo} ELO
            </Text>
            .
          </Text>
        </View>
      ) : null}

      <View className="flex-1 px-6">
        {top.isLoading ? (
          <Text className="text-secondary dark:text-secondary-dark">
            Loading…
          </Text>
        ) : top.error ? (
          <Text className="text-red-500">Couldn't load leaderboard.</Text>
        ) : (
          <FlatList
            data={top.data?.entries ?? []}
            keyExtractor={(item) => item.userId}
            renderItem={({ item }) => <Row entry={item} />}
            ItemSeparatorComponent={() => <View className="h-px bg-elevated dark:bg-elevated-dark" />}
            ListEmptyComponent={
              <Text className="text-secondary dark:text-secondary-dark text-center mt-12">
                No ranked players yet. Be the first!
              </Text>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  return (
    <View className="flex-row items-center py-3">
      <Text className="w-10 text-secondary dark:text-secondary-dark font-mono">
        #{entry.rank}
      </Text>
      <Text className="flex-1 text-primary dark:text-primary-dark">
        {entry.username ?? "Unnamed"}
      </Text>
      <Text className="text-primary dark:text-primary-dark font-semibold">
        {entry.elo}
      </Text>
    </View>
  );
}
