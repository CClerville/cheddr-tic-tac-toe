import { Pressable, Text } from "react-native";
import type { CellValue, Position } from "@cheddr/game-engine";

interface CellProps {
  value: CellValue;
  position: Position;
  onPress: (position: Position) => void;
  disabled: boolean;
}

export function Cell({ value, position, onPress, disabled }: CellProps) {
  return (
    <Pressable
      onPress={() => onPress(position)}
      disabled={disabled || value !== null}
      className="items-center justify-center aspect-square"
      style={({ pressed }) => ({
        opacity: pressed && !disabled && value === null ? 0.6 : 1,
      })}
    >
      <Text
        className={`text-5xl font-bold ${
          value === "X" ? "text-accent" : "text-zinc-400"
        }`}
      >
        {value ?? ""}
      </Text>
    </Pressable>
  );
}
