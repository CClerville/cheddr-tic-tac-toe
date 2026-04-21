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
    <View className="flex-row gap-2">
      {DIFFICULTIES.map(({ value, label }) => (
        <Pressable
          key={value}
          onPress={() => onChange(value)}
          className={`px-4 py-2 rounded-full ${
            current === value ? "bg-accent" : "bg-zinc-800"
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              current === value ? "text-zinc-900" : "text-zinc-400"
            }`}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
