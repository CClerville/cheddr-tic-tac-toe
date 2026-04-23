import { useScrollToTop } from "@react-navigation/native";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  InteractionManager,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";

import { PressableScale } from "@/components/PressableScale";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { useTabBarScroll } from "@/components/ui/TabBarScrollContext";
import { apiGet } from "@/lib/api";
import { useAuthBootstrap } from "@/providers/AuthBootstrap";
import { tabBar } from "@/theme/tokens";
import type {
  LeaderboardEntry,
  LeaderboardMeResponse,
  LeaderboardTopResponse,
} from "@cheddr/api-types";

export default function LeaderboardScreen() {
  const listRef = useRef<FlatList<LeaderboardEntry>>(null);
  useScrollToTop(listRef);
  const { onScroll, resetVisibility } = useTabBarScroll();
  const insets = useSafeAreaInsets();
  const bottomPad = tabBar.height + insets.bottom + 16;

  const { isSignedIn, isLoaded } = useAuth();
  const { ready: authReady } = useAuthBootstrap();
  const [queriesReady, setQueriesReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setQueriesReady(true);
    });
    return () => task.cancel();
  }, []);

  // Both endpoints accept anon and Clerk tokens; gate on the auth bootstrap
  // so the very first request always has a real bearer attached.
  const queriesEnabled = isLoaded && authReady && queriesReady;

  const top = useQuery<LeaderboardTopResponse>({
    queryKey: ["leaderboard", "top"],
    queryFn: () => apiGet<LeaderboardTopResponse>("/leaderboard/top?limit=50"),
    enabled: queriesEnabled,
  });

  const me = useQuery<LeaderboardMeResponse>({
    queryKey: ["leaderboard", "me", isSignedIn ? "clerk" : "anon"],
    queryFn: () => apiGet<LeaderboardMeResponse>("/leaderboard/me"),
    enabled: queriesEnabled,
  });

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScroll(e);
  };

  const showRankBanner = isSignedIn && me.data && me.data.rank !== null;
  const showQuietRetry = !top.isLoading && top.error;

  return (
    <ScreenContainer>
      {showRankBanner ? (
        <View className="px-6 pb-3">
          <GlassPanel variant="panel">
            <View className="px-4 py-3">
              <Text className="text-secondary dark:text-secondary-dark">
                You are ranked{" "}
                <Text className="text-primary dark:text-primary-dark font-semibold">
                  #{me.data!.rank}
                </Text>{" "}
                with{" "}
                <Text className="text-primary dark:text-primary-dark font-semibold">
                  {me.data!.elo} ELO
                </Text>
                .
              </Text>
            </View>
          </GlassPanel>
        </View>
      ) : null}

      <View className="flex-1 px-6">
        {top.isLoading ? (
          <Text className="text-secondary dark:text-secondary-dark">
            Loading…
          </Text>
        ) : (
          <GlassPanel variant="panel" style={{ flex: 1, marginBottom: 16 }}>
            <FlatList
              ref={listRef}
              data={top.data?.entries ?? []}
              keyExtractor={(item) => item.userId}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onScrollBeginDrag={resetVisibility}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                paddingBottom: bottomPad,
              }}
              renderItem={({ item }) => <Row entry={item} />}
              ItemSeparatorComponent={() => (
                <View className="h-px bg-glassBorder dark:bg-glassBorder-dark opacity-60" />
              )}
              ListEmptyComponent={
                showQuietRetry ? (
                  <RetryPill onRetry={() => void top.refetch()} />
                ) : (
                  <Text className="text-secondary dark:text-secondary-dark text-center mt-12">
                    No ranked players yet. Be the first!
                  </Text>
                )
              }
              ListFooterComponent={
                showQuietRetry && (top.data?.entries?.length ?? 0) > 0 ? (
                  <View className="pt-4">
                    <RetryPill onRetry={() => void top.refetch()} />
                  </View>
                ) : null
              }
            />
          </GlassPanel>
        )}
      </View>
    </ScreenContainer>
  );
}

function RetryPill({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="items-center mt-12">
      <Text className="text-secondary dark:text-secondary-dark mb-3">
        Couldn't refresh ranks.
      </Text>
      <PressableScale
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading the leaderboard"
        className="bg-glass dark:bg-glass-dark border border-glassBorder dark:border-glassBorder-dark px-4 py-2 rounded-full"
      >
        <Text className="text-primary dark:text-primary-dark text-sm font-medium">
          Try again
        </Text>
      </PressableScale>
    </View>
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
