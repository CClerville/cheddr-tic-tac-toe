import { useMutation } from "@tanstack/react-query";

import type { HintResponse } from "@cheddr/api-types";

import { ApiError, apiPost } from "@/lib/api";

export function useHintMutation() {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      return await apiPost<HintResponse, { sessionId: string }>("/ai/hint", {
        sessionId,
      });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 429) {
        // Caller may show toast
      }
    },
  });
}
