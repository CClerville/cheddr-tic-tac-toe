import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useAuth, useClerk } from "@clerk/clerk-expo";

import { PressableScale } from "@/components/PressableScale";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { API_BASE_URL, ApiError, apiGet } from "@/lib/api";
import { ProfileSchema, type Profile } from "@cheddr/api-types";

export default function ProfileScreen() {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const { signOut } = useClerk();

  const { data, isLoading, error, refetch } = useQuery<Profile>({
    queryKey: ["user", "me", userId ?? "signed-out"],
    queryFn: () => apiGet("/user/me", ProfileSchema),
    enabled: isLoaded && (!isSignedIn || !!userId),
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
          Profile
        </Text>
        <View className="w-12" />
      </View>

      <View className="flex-1 px-6 gap-6">
        {isLoading ? (
          <ProfileModalSkeleton />
        ) : error ? (
          <View className="gap-3">
            <Text className="text-red-500 font-semibold">
              Couldn't load profile.
            </Text>
            <Text className="text-secondary dark:text-secondary-dark text-xs">
              {describeProfileError(error)}
            </Text>
            <Text className="text-secondary dark:text-secondary-dark text-xs opacity-60">
              API: {API_BASE_URL}
            </Text>
            <PressableScale
              onPress={() => refetch()}
              className="self-start bg-elevated dark:bg-elevated-dark px-4 py-2 rounded-full"
              accessibilityRole="button"
              accessibilityLabel="Retry"
            >
              <Text className="text-primary dark:text-primary-dark">Retry</Text>
            </PressableScale>
          </View>
        ) : data ? (
          <>
            <View className="items-center gap-2">
              <Text className="text-3xl font-bold text-primary dark:text-primary-dark">
                {data.username ?? (data.kind === "anon" ? "Guest" : "Player")}
              </Text>
              <Text className="text-secondary dark:text-secondary-dark">
                {data.kind === "clerk" ? "Signed in" : "Anonymous"}
              </Text>
            </View>

            <View className="bg-elevated dark:bg-elevated-dark rounded-2xl p-4 gap-3">
              <Row label="ELO" value={String(data.elo)} />
              <Row label="Games" value={String(data.gamesPlayed)} />
              <Row label="Wins" value={String(data.wins)} />
              <Row label="Losses" value={String(data.losses)} />
              <Row label="Draws" value={String(data.draws)} />
            </View>

            {!isSignedIn ? (
              <PressableScale
                onPress={() => router.push("/sign-in")}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                className="bg-accent dark:bg-accent-dark py-4 rounded-full items-center"
              >
                <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold text-lg">
                  Sign in to rank
                </Text>
              </PressableScale>
            ) : (
              <PressableScale
                onPress={async () => {
                  await signOut();
                  router.replace("/");
                }}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                className="bg-elevated dark:bg-elevated-dark py-4 rounded-full items-center"
              >
                <Text className="text-primary dark:text-primary-dark font-semibold text-lg">
                  Sign out
                </Text>
              </PressableScale>
            )}
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function ProfileModalSkeleton() {
  return (
    <SkeletonGroup accessibilityLabel="Loading profile">
      <View className="items-center gap-2">
        <Skeleton width="55%" height={32} radius={8} />
        <Skeleton width="36%" height={18} radius={6} />
      </View>
      <View className="bg-elevated dark:bg-elevated-dark rounded-2xl p-4 gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <View key={i} className="flex-row justify-between items-center">
            <Skeleton width={72} height={18} radius={4} />
            <Skeleton width={44} height={18} radius={4} />
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

/**
 * The user-visible error label tells us almost nothing on its own. We expose
 * status + request id (when available) so server logs can be cross-referenced
 * and so distinct failure modes (Vercel SSO 401, Clerk verify 401, network)
 * are immediately distinguishable on-device.
 */
function describeProfileError(err: unknown): string {
  if (err instanceof ApiError) {
    const reqId = err.requestId ? ` · req ${err.requestId}` : "";
    return `HTTP ${err.status}: ${err.message}${reqId}`;
  }
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-secondary dark:text-secondary-dark">{label}</Text>
      <Text className="text-primary dark:text-primary-dark font-semibold">
        {value}
      </Text>
    </View>
  );
}
