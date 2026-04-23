import { Text, View } from "react-native";

import { NeumorphicButton } from "@/components/ui/NeumorphicButton";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme/ThemeProvider";
import type { Difficulty } from "@cheddr/game-engine";

interface DifficultyPickerProps {
  current: Difficulty;
  onChange: (difficulty: Difficulty) => void;
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Medium" },
  { value: "expert", label: "Expert" },
];

export function DifficultyPicker({ current, onChange }: DifficultyPickerProps) {
  const { palette } = useTheme();

  return (
    <View className="flex-row gap-2" accessibilityRole="radiogroup">
      {DIFFICULTIES.map(({ value, label }) => {
        const selected = current === value;
        return (
          <NeumorphicButton
            key={value}
            onPress={() => {
              haptics.selectionChange();
              onChange(value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            className="px-4 py-2.5 rounded-full bg-subtle dark:bg-subtle-dark items-center justify-center"
            style={
              selected
                ? {
                    borderWidth: 2,
                    borderColor: palette.playerX,
                  }
                : { borderWidth: 2, borderColor: "transparent" }
            }
          >
            <Text
              className={`text-sm font-semibold ${
                selected
                  ? "text-primary dark:text-primary-dark"
                  : "text-secondary dark:text-secondary-dark"
              }`}
            >
              {label}
            </Text>
          </NeumorphicButton>
        );
      })}
    </View>
  );
}
