import { useQuery } from "@tanstack/react-query";

import type { AnalysisResponse } from "@cheddr/api-types";

import { apiPost } from "@/lib/api";

export function useGameAnalysis(gameId: string | null) {
  return useQuery({
    queryKey: ["ai", "analysis", gameId],
    enabled: Boolean(gameId),
    staleTime: Infinity,
    queryFn: async () => {
      if (!gameId) throw new Error("gameId required");
      return await apiPost<AnalysisResponse, { gameId: string }>("/ai/analysis", {
        gameId,
      });
    },
  });
}
