import { ActivityIndicator, Text, View } from "react-native";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { useGameAnalysis } from "@/hooks/useGameAnalysis";

interface AnalysisPanelProps {
  gameId: string | null;
}

const SEVERITY_LABEL: Record<string, string> = {
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

export function AnalysisPanel({ gameId }: AnalysisPanelProps) {
  const q = useGameAnalysis(gameId);

  if (!gameId) return null;

  if (q.isPending) {
    return (
      <GlassPanel variant="panel" style={{ width: "100%", marginTop: 16 }}>
        <View className="py-6 items-center">
          <ActivityIndicator />
          <Text className="text-sm text-muted dark:text-muted-dark mt-2">
            Generating analysis…
          </Text>
        </View>
      </GlassPanel>
    );
  }

  if (q.isError) {
    return (
      <GlassPanel variant="panel" style={{ width: "100%", marginTop: 16 }}>
        <Text className="text-sm text-red-500 px-4 py-3">
          {(q.error as Error).message ?? "Analysis failed"}
        </Text>
      </GlassPanel>
    );
  }

  if (!q.data) return null;

  return (
    <GlassPanel variant="panel" style={{ width: "100%", marginTop: 16 }}>
      <View className="px-4 py-4 gap-3">
        <Text className="text-xs uppercase tracking-widest text-muted dark:text-muted-dark">
          Coach review
        </Text>
        <Text className="text-base text-secondary dark:text-secondary-dark leading-6">
          {q.data.summary}
        </Text>
        <View className="gap-2 mt-1">
          {q.data.turns.map((t) => (
            <View
              key={`${t.moveIndex}-${t.severity}`}
              className="border-l-2 border-accent dark:border-accent-dark pl-3 py-1"
            >
              <Text className="text-xs font-semibold text-primary dark:text-primary-dark">
                Move {t.moveIndex} · {SEVERITY_LABEL[t.severity] ?? t.severity}
              </Text>
              <Text className="text-sm text-secondary dark:text-secondary-dark mt-0.5">
                {t.comment}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </GlassPanel>
  );
}
