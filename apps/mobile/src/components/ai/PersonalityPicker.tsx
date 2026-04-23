import { Text, View } from "react-native";

import { PressableScale } from "@/components/PressableScale";
import type { Personality } from "@cheddr/api-types";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme/ThemeProvider";

const OPTIONS: { id: Personality; label: string; hint: string }[] = [
  { id: "trash_talk", label: "Trash talk", hint: "Playful rival" },
  { id: "coach", label: "Coach", hint: "Supportive tips" },
  { id: "zen_master", label: "Zen", hint: "Calm focus" },
  { id: "sports_caster", label: "Caster", hint: "Play-by-play" },
];

interface PersonalityPickerProps {
  value: Personality;
  onChange: (p: Personality) => void;
}

export function PersonalityPicker({ value, onChange }: PersonalityPickerProps) {
  const { palette } = useTheme();
  return (
    <View className="gap-2">
      <Text className="text-xs uppercase tracking-widest text-muted dark:text-muted-dark">
        AI personality
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const selected = opt.id === value;
          return (
            <PressableScale
              key={opt.id}
              onPress={() => {
                haptics.selectionChange();
                onChange(opt.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${opt.label}. ${opt.hint}`}
              className="px-3 py-2 rounded-xl border"
              style={{
                borderColor: selected ? palette.accent : palette.glassBorder,
                backgroundColor: selected ? `${palette.accent}22` : "transparent",
              }}
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: selected ? palette.accent : palette.primary }}
              >
                {opt.label}
              </Text>
              <Text className="text-[10px] text-muted dark:text-muted-dark mt-0.5">
                {opt.hint}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}
