import type { GatewayModelId, GatewayProvider } from "@ai-sdk/gateway";
import { createGateway } from "@ai-sdk/gateway";

import { getEnv } from "../../env.js";
import type { AppDeps } from "../../types.js";

let gatewayProvider: GatewayProvider | null = null;
let gatewayProviderKey: string | undefined;

/**
 * Lazily construct the Vercel AI Gateway client. When `AI_GATEWAY_API_KEY` is
 * set in env, it is passed explicitly to `createGateway` so auth matches our
 * validated `getEnv()` snapshot. When unset, the SDK uses OIDC (e.g. on Vercel
 * or with `VERCEL_OIDC_TOKEN` from `vercel env pull`).
 *
 * Important: a stale or invalid API key in `.env.local` takes precedence over
 * OIDC and will produce 401s until the key is fixed or removed.
 */
export function getGatewayProvider(): GatewayProvider {
  const key = getEnv().AI_GATEWAY_API_KEY;
  if (gatewayProvider && gatewayProviderKey === key) {
    return gatewayProvider;
  }
  gatewayProvider = createGateway(key ? { apiKey: key } : {});
  gatewayProviderKey = key;
  return gatewayProvider;
}

/** Vitest helper — reset cached gateway after env mutations. */
export function resetGatewayProviderForTests(): void {
  gatewayProvider = null;
  gatewayProviderKey = undefined;
}

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
  return getGatewayProvider()(
    asGatewayModelId(env.AI_MODEL ?? DEFAULT_MODEL_ID),
  );
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
  return getGatewayProvider()(
    asGatewayModelId(env.AI_MODEL_COMMENTARY ?? DEFAULT_COMMENTARY_MODEL_ID),
  );
}
