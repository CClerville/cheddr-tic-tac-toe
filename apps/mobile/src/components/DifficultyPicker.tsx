import { View, Text, Pressable } from "react-native";
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
  return (
    <View className="flex-row gap-2" accessibilityRole="radiogroup">
      {DIFFICULTIES.map(({ value, label }) => {
        const selected = current === value;
        return (
          <Pressable
            key={value}
            onPress={() => onChange(value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            className={`px-4 py-2 rounded-full ${
              selected
                ? "bg-accent dark:bg-accent-dark"
                : "bg-subtle dark:bg-subtle-dark"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                selected
                  ? "text-accent-contrast dark:text-accent-contrast-dark"
                  : "text-secondary dark:text-secondary-dark"
              }`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
