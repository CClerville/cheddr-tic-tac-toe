import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View, Platform } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTabBarScroll } from "@/components/ui/TabBarScrollContext";
import { haptics } from "@/lib/haptics";
import { glassPanel } from "@/theme/effects";
import { tabBar } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeProvider";

type TabName = "index" | "leaderboard" | "profile";
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const LABELS: Record<TabName, string> = {
  index: "Home",
  leaderboard: "Ranks",
  profile: "Profile",
};

const ICONS: Record<TabName, { active: IoniconName; inactive: IoniconName }> = {
  index: { active: "home", inactive: "home-outline" },
  leaderboard: { active: "trophy", inactive: "trophy-outline" },
  profile: { active: "person-circle", inactive: "person-circle-outline" },
};

export function GlassTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { resolved, palette } = useTheme();
  const recipe = glassPanel(resolved, "panel");
  const intensity = Math.min(recipe.blurIntensity, Platform.OS === "android" ? 30 : 80);
  const { tabBarAnimatedStyle } = useTabBarScroll();

  const preferBlur =
    Platform.OS !== "web" &&
    !(Platform.OS === "android" && Number(Platform.Version) < 31);

  const barHeight = tabBar.height + insets.bottom;

  const renderTab = (name: TabName) => {
    const routeIndex = state.routes.findIndex((r) => r.name === name);
    if (routeIndex < 0) return null;
    const route = state.routes[routeIndex];
    if (!route) return null;
    const focused = state.index === routeIndex;
    const descriptor = descriptors[route.key];
    if (!descriptor) return null;
    const { options } = descriptor;

    const onPress = () => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(name as never);
        queueMicrotask(() => haptics.selectionChange());
      } else if (focused) {
        queueMicrotask(() => haptics.selectionChange());
      }
    };

    const onLongPress = () => {
      navigation.emit({
        type: "tabLongPress",
        target: route.key,
      });
    };

    const color = focused ? palette.accent : palette.muted;

    return (
      <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={options.tabBarAccessibilityLabel ?? LABELS[name]}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.tabHit}
      >
        <View style={styles.tabInner} className="items-center justify-center">
          <Ionicons
            name={focused ? ICONS[name].active : ICONS[name].inactive}
            size={22}
            color={color}
            style={styles.glyph}
          />
          <Text
            style={[styles.label, { color }]}
            numberOfLines={1}
            className="font-semibold"
          >
            {LABELS[name]}
          </Text>
        </View>
      </Pressable>
    );
  };

  const inner = (
    <View
      style={[
        styles.row,
        { paddingBottom: insets.bottom, minHeight: tabBar.height },
      ]}
    >
      {renderTab("index")}
      {renderTab("leaderboard")}
      {renderTab("profile")}
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.outer,
        { paddingBottom: 0 },
        tabBarAnimatedStyle,
      ]}
    >
      <View style={[styles.clip, { height: barHeight }]}>
        {preferBlur ? (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: recipe.borderColor,
                overflow: "hidden",
              },
            ]}
          >
            <BlurView
              intensity={intensity}
              tint={resolved === "dark" ? "dark" : "light"}
              style={StyleSheet.absoluteFillObject}
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: recipe.backgroundColor },
              ]}
            />
            {inner}
          </View>
        ) : (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: recipe.backgroundColor,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: recipe.borderColor,
              },
            ]}
          >
            {inner}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  clip: {
    overflow: "visible",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  tabHit: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: "center",
    paddingBottom: 4,
  },
  tabInner: {
    minWidth: 48,
    minHeight: 44,
  },
  glyph: {
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
  },
});
