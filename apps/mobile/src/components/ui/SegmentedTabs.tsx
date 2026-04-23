import { useEffect, useState } from "react";
import { LayoutChangeEvent, Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const SPRING = { damping: 20, stiffness: 220 };

export function SegmentedTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (key: T) => void;
}) {
  const activeIndex = Math.max(0, tabs.indexOf(active));
  const [rowWidth, setRowWidth] = useState(0);
  const pad = 8;
  const segmentW = rowWidth > 0 ? (rowWidth - pad) / tabs.length : 0;
  const translateX = useSharedValue(0);
  const segmentWidthSv = useSharedValue(0);

  useEffect(() => {
    segmentWidthSv.value = segmentW;
    translateX.value = withSpring(activeIndex * segmentW, SPRING);
  }, [activeIndex, segmentW, translateX, segmentWidthSv]);

  const onRowLayout = (e: LayoutChangeEvent) => {
    setRowWidth(e.nativeEvent.layout.width);
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    width: segmentWidthSv.value,
    opacity: segmentWidthSv.value > 0 ? 1 : 0,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      className="flex-row rounded-2xl p-1 bg-glass dark:bg-glass-dark border border-glassBorder dark:border-glassBorder-dark relative"
      onLayout={onRowLayout}
    >
      <Animated.View
        pointerEvents="none"
        className="absolute left-1 top-1 bottom-1 rounded-xl bg-accent/20 dark:bg-accent-dark/25"
        style={[{ top: 4, bottom: 4, left: 4 }, indicatorStyle]}
      />
      {tabs.map((key) => {
        const selected = key === active;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(key)}
            className="flex-1 py-3 px-1 items-center justify-center z-10"
            style={{ minHeight: 44 }}
          >
            <Text
              numberOfLines={1}
              className={`text-xs font-semibold text-center ${
                selected
                  ? "text-accent dark:text-accent-dark"
                  : "text-secondary dark:text-secondary-dark"
              }`}
            >
              {key}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
