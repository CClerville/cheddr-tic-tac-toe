import { router } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CombinedStatsPanel } from "@/components/stats/CombinedStatsPanel";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { NeumorphicButton } from "@/components/ui/NeumorphicButton";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { useCombinedStats } from "@/hooks/useCombinedStats";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme/ThemeProvider";
import { tabBar } from "@/theme/tokens";

/** Circular Play CTA on home — slightly larger than the old tab-bar FAB (64). */
const PLAY_CTA_SIZE = 76;

const HOW_TO_PLAY_RULES = [
  "Take turns placing your mark on the 3×3 board.",
  "Avoid making three in a row — that loses the round.",
  "Force your opponent into a three-in-a-row to win.",
] as const;

export default function HomeScreen() {
  const { combined, hasRanked } = useCombinedStats();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = tabBar.height + insets.bottom + 12;

  return (
    <ScreenContainer>
      <View
        className="flex-1 px-6 pt-2"
        style={{ paddingBottom: bottomPad }}
      >
        <View className="items-center mt-2">
          <Text
            className="text-5xl font-extrabold text-primary dark:text-primary-dark"
            style={{ letterSpacing: -1.5 }}
          >
            Cheddr Tic-Tac-Toe
          </Text>
          <Text className="text-base text-secondary dark:text-secondary-dark mt-2">
            Misere
          </Text>
          <Text className="text-xs uppercase tracking-[0.2em] text-muted dark:text-muted-dark mt-4">
            Three-in-a-row loses
          </Text>
        </View>

        <GlassPanel variant="panel" style={{ marginTop: 28, width: "100%" }}>
          <CombinedStatsPanel
            variant="embedded"
            wins={combined.wins}
            losses={combined.losses}
            draws={combined.draws}
            hasRanked={hasRanked}
          />
        </GlassPanel>

        <GlassPanel
          variant="panel"
          style={{ marginTop: 22, width: "100%" }}
          accessible
          accessibilityRole="summary"
          accessibilityLabel="How to play. Take turns placing your mark on the 3 by 3 board. Avoid making three in a row, that loses the round. Force your opponent into a three in a row to win."
        >
          <View className="px-4 py-4">
            <Text className="text-xs uppercase tracking-[0.2em] text-muted dark:text-muted-dark">
              How to play
            </Text>
            <View className="mt-3 gap-3">
              {HOW_TO_PLAY_RULES.map((rule) => (
                <View key={rule} className="flex-row gap-3">
                  <View className="pt-1.5">
                    <View className="h-2 w-2 rounded-full bg-accent dark:bg-accent-dark" />
                  </View>
                  <Text className="flex-1 text-sm leading-5 text-secondary dark:text-secondary-dark">
                    {rule}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </GlassPanel>

        <View className="items-center mt-7">
          <NeumorphicButton
            accessibilityRole="button"
            accessibilityLabel="Play new game"
            accessibilityHint="Choose difficulty and start a game"
            onPress={() => {
              haptics.selectionChange();
              router.push("/setup");
            }}
            style={{
              width: PLAY_CTA_SIZE,
              height: PLAY_CTA_SIZE,
              borderRadius: PLAY_CTA_SIZE / 2,
              backgroundColor: palette.accent,
            }}
            className="items-center justify-center"
          >
            <Text
              style={{ color: palette.accentContrast }}
              className="font-extrabold text-xl"
            >
              Play
            </Text>
          </NeumorphicButton>
        </View>
      </View>
    </ScreenContainer>
  );
}
