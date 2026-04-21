import { Text, View } from "react-native";

import { PressableScale } from "@/components/PressableScale";
import { haptics } from "@/lib/haptics";
import {
  useTheme,
  type ThemePreference,
} from "@/theme/ThemeProvider";

const OPTIONS: { value: ThemePreference; label: string; a11y: string }[] = [
  { value: "light", label: "Light", a11y: "Light theme" },
  { value: "system", label: "Auto", a11y: "Follow system theme" },
  { value: "dark", label: "Dark", a11y: "Dark theme" },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Theme"
      className="flex-row gap-2 bg-elevated dark:bg-elevated-dark p-1 rounded-full"
    >
      {OPTIONS.map(({ value, label, a11y }) => {
        const selected = preference === value;
        return (
          <PressableScale
            key={value}
            onPress={() => {
              haptics.selectionChange();
              setPreference(value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={a11y}
            className={`px-4 py-2 rounded-full ${
              selected ? "bg-accent dark:bg-accent-dark" : ""
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                selected
                  ? "text-accent-contrast dark:text-accent-contrast-dark"
                  : "text-secondary dark:text-secondary-dark"
              }`}
            >
              {label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
