import { gateway } from "@ai-sdk/gateway";
import type { GatewayModelId } from "@ai-sdk/gateway";

import { getEnv } from "../../env.js";
import type { AppDeps } from "../../types.js";

export function resolveLanguageModel(deps: AppDeps) {
  if (deps.languageModelOverride) {
    return deps.languageModelOverride();
  }
  const env = getEnv();
  const id = (env.AI_MODEL ?? "openai/gpt-4o-mini") as GatewayModelId;
  return gateway(id);
}

/** Stronger default than `resolveLanguageModel` for spatial commentary accuracy. */
export function resolveCommentaryModel(deps: AppDeps) {
  if (deps.commentaryLanguageModelOverride) {
    return deps.commentaryLanguageModelOverride();
  }
  if (deps.languageModelOverride) {
    return deps.languageModelOverride();
  }
  const env = getEnv();
  const id = (env.AI_MODEL_COMMENTARY ?? "openai/gpt-4.1-mini") as GatewayModelId;
  return gateway(id);
}
