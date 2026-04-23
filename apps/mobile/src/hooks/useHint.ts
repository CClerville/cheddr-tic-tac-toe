import { useMutation } from "@tanstack/react-query";

import { HintResponseSchema } from "@cheddr/api-types";

import { ApiError, apiPost } from "@/lib/api";

export function useHintMutation() {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      return await apiPost("/ai/hint", { sessionId }, HintResponseSchema);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 429) {
        // Caller may show toast
      }
    },
  });
}
