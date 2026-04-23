import { Text } from "react-native";

import { PressableScale } from "@/components/PressableScale";
import { haptics } from "@/lib/haptics";
import { useHintMutation } from "@/hooks/useHint";
import type { Position } from "@cheddr/game-engine";

interface HintButtonProps {
  sessionId: string | null;
  /** When false, hint is hidden (e.g. not player's turn). */
  canHint: boolean;
  onSuggest: (position: Position | null, reasoning: string) => void;
}

export function HintButton({ sessionId, canHint, onSuggest }: HintButtonProps) {
  const hint = useHintMutation();

  if (!sessionId || !canHint) return null;

  return (
    <PressableScale
      onPress={() => {
        if (!sessionId) return;
        haptics.selectionChange();
        void (async () => {
          try {
            const res = await hint.mutateAsync(sessionId);
            onSuggest(res.position, res.reasoning);
          } catch {
            haptics.illegalTap();
          }
        })();
      }}
      accessibilityRole="button"
      accessibilityLabel="Hint"
      accessibilityHint="Suggests a strong next move using AI"
      className="px-4 py-2 rounded-full bg-glass dark:bg-glass-dark border border-glassBorder dark:border-glassBorder-dark"
    >
      <Text className="text-sm font-semibold text-primary dark:text-primary-dark">
        {hint.isPending ? "Thinking…" : "Hint"}
      </Text>
    </PressableScale>
  );
}
