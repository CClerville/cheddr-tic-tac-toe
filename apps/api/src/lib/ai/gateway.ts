import { gateway } from "@ai-sdk/gateway";
import type { GatewayModelId } from "@ai-sdk/gateway";

import { getEnv } from "../../env.js";
import type { AppDeps } from "../../types.js";

/**
 * Default Vercel AI Gateway model used for hint/analysis routes — fast,
 * cheap, capable of structured output.
 */
export const DEFAULT_MODEL_ID = "openai/gpt-4o-mini" as const satisfies GatewayModelId;

/**
 * Default model for commentary streams — uses 4.1-mini for stronger spatial
 * reasoning so it doesn't claim row 1 contains a win when it doesn't.
 */
export const DEFAULT_COMMENTARY_MODEL_ID =
  "openai/gpt-4.1-mini" as const satisfies GatewayModelId;

/**
 * Single, type-checked entry point that turns an env-provided string into a
 * gateway model id. We narrow the cast here so call sites don't need to
 * know about the `as GatewayModelId` escape hatch.
 *
 * The cast is unavoidable because the `GatewayModelId` union is defined by
 * the gateway SDK and we explicitly support pinning to non-listed model
 * versions via env (e.g. day-zero rollouts).
 */
export function asGatewayModelId(id: string): GatewayModelId {
  return id as GatewayModelId;
}

export function resolveLanguageModel(deps: AppDeps) {
  if (deps.languageModelOverride) {
    return deps.languageModelOverride();
  }
  const env = getEnv();
  return gateway(asGatewayModelId(env.AI_MODEL ?? DEFAULT_MODEL_ID));
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
  return gateway(
    asGatewayModelId(env.AI_MODEL_COMMENTARY ?? DEFAULT_COMMENTARY_MODEL_ID),
  );
}
