import { useScrollToTop } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useClerk } from "@clerk/clerk-expo";
import Constants from "expo-constants";

import { CombinedStatsPanel } from "@/components/stats/CombinedStatsPanel";
import { DifficultyBreakdown } from "@/components/profile/DifficultyBreakdown";
import { EditProfileSheet } from "@/components/profile/EditProfileSheet";
import { PersonalityBreakdown } from "@/components/profile/PersonalityBreakdown";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileSettingsCard } from "@/components/profile/ProfileSettingsCard";
import { ProfileSkeleton } from "@/components/profile/ProfileSkeleton";
import { SignedOutProfile } from "@/components/profile/SignedOutProfile";
import { SignOutSheet } from "@/components/profile/SignOutSheet";
import { PressableScale } from "@/components/PressableScale";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { useTabBarScroll } from "@/components/ui/TabBarScrollContext";
import { WinRateRing } from "@/components/ui/WinRateRing";
import { useCombinedStats } from "@/hooks/useCombinedStats";
import { useLocalGameStats } from "@/hooks/useLocalGameStats";
import { useProfile } from "@/hooks/useProfile";
import { useUserStats } from "@/hooks/useUserStats";
import { useAuthBootstrap } from "@/providers/AuthBootstrap";
import { tabBar } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeProvider";

// Tab identifiers are deliberately decoupled from the user-visible labels
// so we can localize the labels without rewriting the equality checks
// that drive which sub-panel renders.
const SIGNED_IN_TAB_IDS = ["overview", "byDifficulty", "byPersonality"] as const;
type SignedInTabId = (typeof SIGNED_IN_TAB_IDS)[number];
type ProfileTabId = SignedInTabId;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { onScroll, resetVisibility } = useTabBarScroll();
  const { isSignedIn, isLoaded } = useAuth();
  const { ready: authReady } = useAuthBootstrap();
  const { signOut } = useClerk();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = tabBar.height + insets.bottom + 24;

  const tabLabels = useMemo(
    () => ({
      overview: t("profile.tabs.overview"),
      byDifficulty: t("profile.tabs.byDifficulty"),
      byPersonality: t("profile.tabs.byPersonality"),
    }),
    [t],
  );
  const tabsForSegmented = useMemo(
    () => SIGNED_IN_TAB_IDS.map((id) => tabLabels[id]),
    [tabLabels],
  );

  const [tab, setTab] = useState<ProfileTabId>("overview");
  const { stats: localStats } = useLocalGameStats();
  const { combined, hasRanked } = useCombinedStats();
  const { data: userStats } = useUserStats();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Anon users have a server-side profile (so leaderboard works for
  // everyone), but we deliberately keep the signed-out CTA the focal point
  // of this tab — `useProfile` defaults to signed-in-only.
  const { data, isLoading, error, refetch } = useProfile();

  // When the user signs out, fall back to a tab that doesn't depend on
  // server data so we never render an empty state for signed-in-only tabs.
  useEffect(() => {
    if (!isSignedIn && (tab === "overview" || tab === "byPersonality")) {
      setTab("byDifficulty");
    }
  }, [isSignedIn, tab]);

  const version =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "—";

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
            localStats={localStats}
            version={version}
            palette={palette}
          />
        ) : isLoading ? (
          <ProfileSkeleton />
        ) : error ? (
          <View className="gap-3">
            <Text className="text-red-500">{t("profile.loadError")}</Text>
            <PressableScale
              onPress={() => refetch()}
              className="self-start bg-glass dark:bg-glass-dark border border-glassBorder dark:border-glassBorder-dark px-4 py-2 rounded-full"
              accessibilityRole="button"
              accessibilityLabel={t("common.retry")}
            >
              <Text className="text-primary dark:text-primary-dark">
                {t("common.retry")}
              </Text>
            </PressableScale>
          </View>
        ) : data ? (
          <>
            <ProfileHeader
              displayName={
                data.displayName ?? data.username ?? t("profile.fallbackName")
              }
              handle={
                data.username ? `@${data.username}` : t("profile.fallbackHandle")
              }
              elo={data.elo}
              avatarBg={data.avatarColor ?? palette.accent}
              palette={palette}
              onEditProfile={handleEditProfile}
            />

            <SegmentedTabs
              tabs={tabsForSegmented}
              active={tabLabels[tab]}
              onChange={(label) => {
                const id = SIGNED_IN_TAB_IDS.find(
                  (key) => tabLabels[key] === label,
                );
                if (id) setTab(id);
              }}
            />

            {tab === "overview" ? (
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
                      {t("profile.winRateLabel")}
                    </Text>
                    <WinRateRing
                      wins={data.wins}
                      losses={data.losses}
                      draws={data.draws}
                    />
                    <Text className="text-center text-xs text-muted dark:text-muted-dark mt-4">
                      {t("profile.gamesPlayed", { count: data.gamesPlayed })}
                    </Text>
                  </View>
                </GlassPanel>
                <ProfileSettingsCard
                  version={version}
                  onSignOutPress={() => setSignOutOpen(true)}
                />
              </View>
            ) : null}

            {tab === "byDifficulty" ? (
              <DifficultyBreakdown serverStats={userStats} />
            ) : null}

            {tab === "byPersonality" ? (
              <PersonalityBreakdown serverStats={userStats} />
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

      <SignOutSheet
        visible={signOutOpen}
        onConfirm={() => void confirmSignOut()}
        onDismiss={() => setSignOutOpen(false)}
      />
    </ScreenContainer>
  );
}
