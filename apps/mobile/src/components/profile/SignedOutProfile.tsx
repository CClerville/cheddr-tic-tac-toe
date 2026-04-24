import { router } from "expo-router";
import { Text, View } from "react-native";

import { DifficultyBreakdown } from "@/components/profile/DifficultyBreakdown";
import { PressableScale } from "@/components/PressableScale";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { type GameStats } from "@/storage/gameRepository";
import type { useTheme } from "@/theme/ThemeProvider";

export interface SignedOutProfileProps {
  localStats: GameStats;
  version: string;
  palette: ReturnType<typeof useTheme>["palette"];
}

/**
 * Signed-out variant of the profile tab.
 *
 * Showcases the local-only stats and a sign-in CTA — no server fetch
 * is initiated by this view (anon profile data is intentionally not
 * surfaced here; see comment in the parent screen).
 */
export function SignedOutProfile({
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

      <DifficultyBreakdown localStats={localStats} />

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
    </>
  );
}
