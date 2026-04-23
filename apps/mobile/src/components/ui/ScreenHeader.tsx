import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

export function BackButton({
  label = "Back",
  onPress,
}: {
  label?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{
        minWidth: 44,
        minHeight: 44,
        justifyContent: "center",
        paddingHorizontal: 8,
      }}
    >
      <Text className="text-base text-accent dark:text-accent-dark">{label}</Text>
    </Pressable>
  );
}

export function ScreenHeader({
  title,
  titleClassName,
  leading,
  trailing,
}: {
  title: string;
  titleClassName?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between px-2 py-2 min-h-[52px]">
      <View className="min-w-[44px] items-start justify-center">
        {leading ?? <BackButton />}
      </View>
      <View className="flex-1 min-w-0 px-1 items-center justify-center">
        <Text
          className={`text-base font-semibold text-primary dark:text-primary-dark text-center ${titleClassName ?? ""}`}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      <View className="min-w-[44px] items-end justify-center">
        {trailing ?? <View style={{ width: 44 }} />}
      </View>
    </View>
  );
}
