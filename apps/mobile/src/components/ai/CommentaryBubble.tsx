import type { CommentaryRequest, Personality } from "@cheddr/api-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { useTypewriter } from "@/hooks/useTypewriter";
import { apiPostStreaming } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";

const PERSONALITY_LABEL: Record<Personality, string> = {
  coach: "Coach",
  trash_talk: "Trash talk",
  zen_master: "Zen",
  sports_caster: "Sports caster",
};

interface CommentaryBubbleProps {
  sessionId: string | null;
  /** Fingerprint of the board (e.g. joined move indices) — bumps trigger move commentary. */
  moveFingerprint: string;
  gameOver: boolean;
  /** Active Cheddr mood (ranked games). Omit for local-only screens. */
  personality?: Personality;
}

/**
 * Streams short AI commentary after each full round-trip move and once
 * when the game ends (uses the server's short-lived post-terminal snapshot).
 */
export function CommentaryBubble({
  sessionId,
  moveFingerprint,
  gameOver,
  personality,
}: CommentaryBubbleProps) {
  const { palette } = useTheme();
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const prevFinger = useRef<string>("");
  const prevOver = useRef(false);
  const terminalFired = useRef(false);

  useEffect(() => {
    prevFinger.current = "";
    terminalFired.current = false;
    prevOver.current = false;
    setText("");
    setError(null);
    setIsStreaming(false);
  }, [sessionId]);

  const displayText = useTypewriter(text, {
    isStreaming,
    reduceMotion: reduceMotion ?? false,
  });

  const runStream = useCallback(
    async (body: CommentaryRequest) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setError(null);
      setText("");
      setIsStreaming(true);
      try {
        const res = await apiPostStreaming("/ai/commentary", body, {
          signal: ac.signal,
        });
        if (!res.ok) {
          let message = `${res.status} ${res.statusText}`;
          try {
            const j = (await res.json()) as { message?: string };
            if (j.message) message = j.message;
          } catch {
            // ignore
          }
          throw new Error(message);
        }
        const reader = res.body?.getReader();
        if (!reader) {
          setText(await res.text());
          return;
        }
        const dec = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          setText(acc);
        }
        acc += dec.decode();
        if (acc) setText(acc);
      } catch (e) {
        // expo/fetch throws a FetchError (not an AbortError) when its
        // underlying native request is canceled, so rely on the signal
        // we control rather than the error name to detect our own aborts.
        if (ac.signal.aborted) return;
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Commentary failed");
      } finally {
        setIsStreaming(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!sessionId || !visible) return;
    if (gameOver) return;
    if (moveFingerprint === prevFinger.current) return;
    if (moveFingerprint === "") return;
    prevFinger.current = moveFingerprint;
    void runStream({ sessionId, trigger: "move" });
  }, [sessionId, moveFingerprint, gameOver, visible, runStream]);

  useEffect(() => {
    if (!sessionId || !visible) return;
    if (!gameOver) {
      prevOver.current = false;
      return;
    }
    if (prevOver.current) return;
    prevOver.current = true;
    if (terminalFired.current) return;
    terminalFired.current = true;
    void runStream({ sessionId, trigger: "terminal" });
  }, [sessionId, gameOver, visible, runStream]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (!sessionId || !visible) return null;

  const headerLabel =
    personality != null
      ? `Cheddr · ${PERSONALITY_LABEL[personality]}`
      : "Cheddr";

  return (
    <View
      className="absolute left-3 right-3 bottom-3 z-50"
      pointerEvents="box-none"
    >
      <GlassPanel variant="panel" style={{ width: "100%" }}>
        <View className="px-3 py-2">
          <View className="flex-row justify-between items-start gap-2">
            <Text className="text-xs uppercase tracking-widest text-muted dark:text-muted-dark">
              {headerLabel}
            </Text>
            <Pressable
              onPress={() => {
                abortRef.current?.abort();
                setIsStreaming(false);
                setVisible(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss Cheddr"
              hitSlop={10}
            >
              <Text style={{ color: palette.muted }} className="text-sm">
                ✕
              </Text>
            </Pressable>
          </View>
          {error ? (
            <Text className="text-xs text-red-500 mt-1">{error}</Text>
          ) : (
            <Text className="text-sm text-secondary dark:text-secondary-dark mt-1 leading-5">
              {displayText || "…"}
            </Text>
          )}
        </View>
      </GlassPanel>
    </View>
  );
}
