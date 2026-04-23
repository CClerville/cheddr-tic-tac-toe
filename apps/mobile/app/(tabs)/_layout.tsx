import { Tabs } from "expo-router";

import { GlassTabBar } from "@/components/ui/GlassTabBar";
import { TabBarScrollProvider } from "@/components/ui/TabBarScrollContext";

export default function TabsLayout() {
  return (
    <TabBarScrollProvider>
      <Tabs
        tabBar={(props) => <GlassTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          freezeOnBlur: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: "Home", tabBarAccessibilityLabel: "Home" }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: "Ranks",
            tabBarAccessibilityLabel: "Leaderboard",
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: "Profile", tabBarAccessibilityLabel: "Profile" }}
        />
      </Tabs>
    </TabBarScrollProvider>
  );
}
