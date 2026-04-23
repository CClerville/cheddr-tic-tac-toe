import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const SPRING = { damping: 22, stiffness: 220 };

type TabBarScrollContextValue = {
  /** 0 = visible, 1 = hidden (translated off-screen). */
  hiddenProgress: ReturnType<typeof useSharedValue<number>>;
  tabBarAnimatedStyle: ReturnType<typeof useAnimatedStyle>;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  resetVisibility: () => void;
};

const TabBarScrollContext = createContext<TabBarScrollContextValue | null>(
  null,
);

export function TabBarScrollProvider({ children }: { children: ReactNode }) {
  const hiddenProgress = useSharedValue(0);
  const lastYOffsetRef = useRef(0);

  const tabBarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hiddenProgress.value * 88 }],
  }));

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - lastYOffsetRef.current;
      lastYOffsetRef.current = y;
      if (y < 24) {
        hiddenProgress.value = withSpring(0, SPRING);
        return;
      }
      if (dy > 8) {
        hiddenProgress.value = withSpring(1, SPRING);
      } else if (dy < -8) {
        hiddenProgress.value = withSpring(0, SPRING);
      }
    },
    [hiddenProgress],
  );

  const resetVisibility = useCallback(() => {
    hiddenProgress.value = withSpring(0, SPRING);
  }, [hiddenProgress]);

  const value = useMemo(
    () => ({
      hiddenProgress,
      tabBarAnimatedStyle,
      onScroll,
      resetVisibility,
    }),
    [hiddenProgress, tabBarAnimatedStyle, onScroll, resetVisibility],
  );

  return (
    <TabBarScrollContext.Provider value={value}>
      {children}
    </TabBarScrollContext.Provider>
  );
}

export function useTabBarScroll(): TabBarScrollContextValue {
  const ctx = useContext(TabBarScrollContext);
  if (!ctx) {
    throw new Error("useTabBarScroll must be used inside TabBarScrollProvider");
  }
  return ctx;
}

export function useOptionalTabBarScroll(): TabBarScrollContextValue | null {
  return useContext(TabBarScrollContext);
}
