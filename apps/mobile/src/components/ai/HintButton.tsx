import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { PressableScale } from "@/components/PressableScale";
import { haptics } from "@/lib/haptics";
import { useHintMutation } from "@/hooks/useHint";
import type { Position } from "@cheddr/game-engine";

interface HintButtonProps {
  sessionId: string | null;
  /** When false, hint is hidden (e.g. not player's turn). */
  canHint: boolean;
  onSuggest: (position: Position | null) => void;
}

export function HintButton({ sessionId, canHint, onSuggest }: HintButtonProps) {
  const hint = useHintMutation();
  const [modal, setModal] = useState(false);
  const [reasoning, setReasoning] = useState("");

  if (!sessionId || !canHint) return null;

  return (
    <>
      <PressableScale
        onPress={() => {
          if (!sessionId) return;
          haptics.selectionChange();
          void (async () => {
            try {
              const res = await hint.mutateAsync(sessionId);
              onSuggest(res.position);
              setReasoning(res.reasoning);
              setModal(true);
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

      <Modal
        visible={modal}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center px-6"
          onPress={() => setModal(false)}
        >
          <Pressable
            className="bg-white dark:bg-neutral-900 rounded-2xl p-5"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-lg font-bold text-primary dark:text-primary-dark">
              Hint
            </Text>
            <Text className="text-sm text-secondary dark:text-secondary-dark mt-3 leading-5">
              {reasoning}
            </Text>
            <PressableScale
              onPress={() => {
                setModal(false);
                onSuggest(null);
              }}
              className="mt-5 py-3 rounded-xl bg-accent dark:bg-accent-dark items-center"
            >
              <Text className="text-accent-contrast dark:text-accent-contrast-dark font-semibold">
                Clear highlight
              </Text>
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
