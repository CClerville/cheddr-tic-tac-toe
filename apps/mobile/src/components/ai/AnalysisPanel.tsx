import { ActivityIndicator, Text, View } from "react-native";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { useGameAnalysis } from "@/hooks/useGameAnalysis";
import { ApiError } from "@/lib/api";

interface AnalysisPanelProps {
  gameId: string | null;
}

const SEVERITY_LABEL: Record<string, string> = {
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

function describeAnalysisError(err: unknown): {
  title: string;
  detail: string;
} {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return {
        title: "Coach review limit reached",
        detail:
          "You've used your free analyses for now. Try again in a little while.",
      };
    }
    if (err.status === 402) {
      return {
        title: "Daily AI quota reached",
        detail: "Coach reviews will refresh tomorrow.",
      };
    }
    if (err.status === 503) {
      return {
        title: "Coach review unavailable",
        detail: "The AI coach is taking a break. Please try again shortly.",
      };
    }
    if (err.status === 404) {
      return {
        title: "Game not found",
        detail: "We couldn't find this game to review.",
      };
    }
  }
  return {
    title: "Coach review failed",
    detail:
      err instanceof Error && err.message
        ? err.message
        : "Something went wrong generating the review.",
  };
}

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
    const { title, detail } = describeAnalysisError(q.error);
    return (
      <GlassPanel variant="panel" style={{ width: "100%", marginTop: 16 }}>
        <View className="px-4 py-4 gap-1">
          <Text className="text-xs uppercase tracking-widest text-muted dark:text-muted-dark">
            Coach review
          </Text>
          <Text className="text-base font-semibold text-primary dark:text-primary-dark">
            {title}
          </Text>
          <Text className="text-sm text-secondary dark:text-secondary-dark">
            {detail}
          </Text>
        </View>
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
