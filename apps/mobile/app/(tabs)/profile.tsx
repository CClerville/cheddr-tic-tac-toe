import { useScrollToTop } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  InteractionManager,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useAuth, useClerk } from "@clerk/clerk-expo";
import Constants from "expo-constants";

import { CombinedStatsPanel } from "@/components/stats/CombinedStatsPanel";
import { EditProfileSheet } from "@/components/profile/EditProfileSheet";
import { PressableScale } from "@/components/PressableScale";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { useTabBarScroll } from "@/components/ui/TabBarScrollContext";
import { WinRateRing } from "@/components/ui/WinRateRing";
import { useCombinedStats } from "@/hooks/useCombinedStats";
import { useLocalGameStats } from "@/hooks/useLocalGameStats";
import { apiGet } from "@/lib/api";
import { useAuthBootstrap } from "@/providers/AuthBootstrap";
import { type GameStats } from "@/storage/gameRepository";
import { tabBar } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeProvider";
import type { Profile } from "@cheddr/api-types";
import type { Difficulty } from "@cheddr/game-engine";

const SIGNED_IN_TABS = ["Overview", "By Difficulty", "Account"] as const;
const SIGNED_OUT_TABS = ["By Difficulty", "Account"] as const;
type SignedInTab = (typeof SIGNED_IN_TABS)[number];
type SignedOutTab = (typeof SIGNED_OUT_TABS)[number];
type ProfileTab = SignedInTab | SignedOutTab;

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "expert"];

function initialsFrom(name: string | null | undefined): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function ProfileScreen() {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { onScroll, resetVisibility } = useTabBarScroll();
  const { isSignedIn, isLoaded, userId } = useAuth();
  const { ready: authReady } = useAuthBootstrap();
  const { signOut } = useClerk();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad =
    tabBar.height + insets.bottom + 24;

  const [fetchReady, setFetchReady] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("Overview");
  const { stats: localStats } = useLocalGameStats();
  const { combined, hasRanked } = useCombinedStats();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setFetchReady(true);
    });
    return () => task.cancel();
  }, []);

  // Server profile is only fetched for authenticated users. Anon users do
  // exist server-side (so leaderboard works for everyone), but we deliberately
  // do not surface anon profiles here to keep the signed-out CTA the focal
  // point of this tab.
  const profileEnabled =
    fetchReady && isLoaded && authReady && !!isSignedIn && !!userId;

  const { data, isLoading, error, refetch } = useQuery<Profile>({
    queryKey: ["user", "me", userId ?? "signed-out"],
    queryFn: () => apiGet<Profile>("/user/me"),
    enabled: profileEnabled,
  });

  // When the user signs out, fall back to a tab that doesn't depend on
  // server data so we never render an "Overview" empty state.
  useEffect(() => {
    if (!isSignedIn && tab === "Overview") {
      setTab("By Difficulty");
    }
  }, [isSignedIn, tab]);

  const displayName = data?.displayName ?? data?.username ?? "Player";
  const handle = data?.username ? `@${data.username}` : "@player";
  const avatarBg = data?.avatarColor ?? palette.accent;

  const version =
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    "—";

  const confirmSignOut = useCallback(async () => {
    await signOut();
    setSignOutOpen(false);
    router.replace("/");
  }, [signOut]);

  const handleEditProfile = useCallback(() => {
    setEditOpen(true);
  }, []);

  return (
    <ScreenContainer>
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={resetVisibility}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: bottomPad,
          gap: 20,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!authReady || !isLoaded ? (
          <ProfileSkeleton />
        ) : !isSignedIn ? (
          <SignedOutProfile
            tab={tab}
            onTabChange={setTab}
            localStats={localStats}
            version={version}
            palette={palette}
          />
        ) : isLoading ? (
          <ProfileSkeleton />
        ) : error ? (
          <View className="gap-3">
            <Text className="text-red-500">Couldn't load profile.</Text>
            <PressableScale
              onPress={() => refetch()}
              className="self-start bg-glass dark:bg-glass-dark border border-glassBorder dark:border-glassBorder-dark px-4 py-2 rounded-full"
              accessibilityRole="button"
              accessibilityLabel="Retry"
            >
              <Text className="text-primary dark:text-primary-dark">Retry</Text>
            </PressableScale>
          </View>
        ) : data ? (
          <>
            <View className="items-center gap-3">
              <View
                className="items-center justify-center rounded-full"
                style={{
                  width: 88,
                  height: 88,
                  backgroundColor: avatarBg,
                }}
              >
                <Text
                  style={{ color: palette.accentContrast }}
                  className="text-2xl font-extrabold"
                >
                  {initialsFrom(displayName)}
                </Text>
              </View>
              <Text className="text-3xl font-bold text-primary dark:text-primary-dark text-center">
                {displayName}
              </Text>
              <Text className="text-secondary dark:text-secondary-dark">
                {handle}
              </Text>
              <View
                className="px-4 py-1.5 rounded-full"
                style={{ backgroundColor: palette.accent }}
              >
                <Text
                  style={{ color: palette.accentContrast }}
                  className="font-bold text-sm"
                >
                  ELO {data.elo}
                </Text>
              </View>
              <PressableScale
                onPress={handleEditProfile}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
                className="border border-glassBorder dark:border-glassBorder-dark py-3 px-8 rounded-full w-full items-center mt-1"
              >
                <Text className="text-primary dark:text-primary-dark font-semibold text-base">
                  Edit profile
                </Text>
              </PressableScale>
            </View>

            <SegmentedTabs
              tabs={SIGNED_IN_TABS}
              active={tab as SignedInTab}
              onChange={(t) => setTab(t)}
            />

            {tab === "Overview" ? (
              <View className="gap-6">
                <CombinedStatsPanel
                  variant="split"
                  wins={combined.wins}
                  losses={combined.losses}
                  draws={combined.draws}
                  hasRanked={hasRanked}
                />
                <GlassPanel variant="panel">
                  <View className="p-6 items-center">
                    <Text className="text-xs uppercase tracking-widest text-muted dark:text-muted-dark mb-4">
                      Win rate (ranked)
                    </Text>
                    <WinRateRing
                      wins={data.wins}
                      losses={data.losses}
                      draws={data.draws}
                    />
                    <Text className="text-center text-xs text-muted dark:text-muted-dark mt-4">
                      {data.gamesPlayed} games played
                    </Text>
                  </View>
                </GlassPanel>
              </View>
            ) : null}

            {tab === "By Difficulty" ? (
              <DifficultyStats stats={localStats} />
            ) : null}

            {tab === "Account" ? (
              <GlassPanel variant="panel">
                <View className="p-4 gap-0">
                  <View className="flex-row items-center justify-between py-3">
                    <Text className="text-primary dark:text-primary-dark font-medium">
                      Theme
                    </Text>
                    <ThemeToggle />
                  </View>
                  <View className="h-px bg-glassBorder dark:bg-glassBorder-dark opacity-70" />
                  <Text className="text-secondary dark:text-secondary-dark text-xs py-3">
                    Version {version}
                  </Text>
                  <View className="h-px bg-glassBorder dark:bg-glassBorder-dark opacity-70" />
                  <Pressable
                    onPress={() => setSignOutOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Sign out"
                    style={{ minHeight: 48, justifyContent: "center" }}
                  >
                    <Text className="text-danger dark:text-danger-dark font-semibold">
                      Sign out
                    </Text>
                  </Pressable>
                </View>
              </GlassPanel>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {data ? (
        <EditProfileSheet
          visible={editOpen}
          profile={data}
          onDismiss={() => setEditOpen(false)}
        />
      ) : null}

      <BottomSheet
        visible={signOutOpen}
        title="Sign out?"
        onDismiss={() => setSignOutOpen(false)}
      >
        <Text className="text-secondary dark:text-secondary-dark mb-4">
          You will return to the home screen. Ranked progress stays on the
          server for when you sign back in.
        </Text>
        <View className="gap-3">
          <PressableScale
            onPress={() => void confirmSignOut()}
            accessibilityRole="button"
            accessibilityLabel="Confirm sign out"
            className="bg-danger dark:bg-danger-dark py-3 rounded-full items-center"
          >
            <Text className="text-white font-semibold">Sign out</Text>
          </PressableScale>
          <PressableScale
            onPress={() => setSignOutOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            className="border border-glassBorder dark:border-glassBorder-dark py-3 rounded-full items-center"
          >
            <Text className="text-primary dark:text-primary-dark font-medium">
              Cancel
            </Text>
          </PressableScale>
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

function ProfileSkeleton() {
  return (
    <View className="gap-4">
      <View
        className="rounded-full self-center bg-glass dark:bg-glass-dark"
        style={{ width: 88, height: 88 }}
      />
      <View className="h-8 rounded-xl bg-glass dark:bg-glass-dark w-3/5 self-center" />
      <View className="h-24 rounded-2xl bg-glass dark:bg-glass-dark" />
    </View>
  );
}

interface SignedOutProfileProps {
  tab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  localStats: GameStats;
  version: string;
  palette: ReturnType<typeof useTheme>["palette"];
}

function SignedOutProfile({
  tab,
  onTabChange,
  localStats,
  version,
  palette,
}: SignedOutProfileProps) {
  return (
    <>
      <View className="items-center gap-3">
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: 88,
            height: 88,
            backgroundColor: palette.glass,
            borderWidth: 1,
            borderColor: palette.glassBorder,
          }}
        >
          <Text
            style={{ color: palette.muted }}
            className="text-3xl font-extrabold"
          >
            ?
          </Text>
        </View>
        <Text className="text-3xl font-bold text-primary dark:text-primary-dark text-center">
          You're playing as Guest
        </Text>
        <Text className="text-secondary dark:text-secondary-dark text-center px-4">
          Sign in to save your ELO, climb the global leaderboard, and sync your
          stats across devices.
        </Text>
        <PressableScale
          onPress={() => router.push("/sign-in")}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          className="bg-accent dark:bg-accent-dark py-3 px-8 rounded-full w-full items-center mt-2"
        >
          <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold text-base">
            Sign in
          </Text>
        </PressableScale>
      </View>

      <SegmentedTabs
        tabs={SIGNED_OUT_TABS}
        active={tab as SignedOutTab}
        onChange={(t) => onTabChange(t)}
      />

      {tab === "By Difficulty" ? (
        <DifficultyStats stats={localStats} />
      ) : null}

      {tab === "Account" ? (
        <GlassPanel variant="panel">
          <View className="p-4 gap-0">
            <View className="flex-row items-center justify-between py-3">
              <Text className="text-primary dark:text-primary-dark font-medium">
                Theme
              </Text>
              <ThemeToggle />
            </View>
            <View className="h-px bg-glassBorder dark:bg-glassBorder-dark opacity-70" />
            <Text className="text-secondary dark:text-secondary-dark text-xs py-3">
              Version {version}
            </Text>
          </View>
        </GlassPanel>
      ) : null}
    </>
  );
}

function DifficultyStats({ stats }: { stats: GameStats }) {
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
