import type { Redis } from "@upstash/redis";
import type { CommentaryRequest } from "@cheddr/api-types";
import { createTextStreamResponse, streamText } from "ai";

import type { AiLimitClient } from "../../lib/ai/rateLimit.js";

import { selectPersistedCommentary } from "../../lib/ai/commentaryGuard.js";
import { incrCommentaryHallucinationMetric } from "../../lib/ai/commentaryMetrics.js";
import {
  buildCommentaryUserPrompt,
  terminalKindFromResult,
} from "../../lib/ai/commentaryPrompt.js";
import { AI_MAX_OUTPUT_TOKENS } from "../../lib/ai/constants.js";
import { resolveCommentaryModel } from "../../lib/ai/gateway.js";
import { buildAiSystemPrompt } from "../../lib/ai/personalities.js";
import { apiError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { getPlayerName } from "../../lib/users.js";
import {
  appendCommentaryLine,
  loadSessionOrSnapshotForAi,
  waitForTerminalSession,
} from "../../lib/session.js";
import type { AppDeps } from "../../types.js";

const log = logger.child({ scope: "ai/commentary" });

import {
  enforceRateLimit,
  reserveTokensOrThrow,
  safeTextStream,
  settleReservation,
} from "./common.js";

export interface CommentaryServiceParams {
  readonly identityId: string;
  readonly request: CommentaryRequest;
  readonly requestId: string | undefined;
}

export interface CommentaryServiceDeps {
  readonly deps: AppDeps;
  readonly redis: Redis;
  readonly db: AppDeps["db"];
  readonly limiter: AiLimitClient;
}

/**
 * Stream Cheddr's running commentary for an in-flight session.
 *
 * Returns a `Response` (SSE-style text stream) directly because the AI
 * SDK manages backpressure and headers internally — the route handler
 * just forwards it to Hono. Token reservation is settled inside the
 * provider's `onFinish`, which fires once the model has actually
 * accounted its usage.
 */
export async function streamCommentary(
  { deps, redis, db, limiter }: CommentaryServiceDeps,
  { identityId, request, requestId }: CommentaryServiceParams,
): Promise<Response> {
  let session = await loadSessionOrSnapshotForAi(redis, request.sessionId);
  if (!session || session.userId !== identityId) {
    throw apiError("session_not_found", "Session not found or expired");
  }

  if (
    request.trigger === "terminal" &&
    session.result.status === "in_progress"
  ) {
    const refreshed = await waitForTerminalSession(
      redis,
      request.sessionId,
      { attempts: 4, delayMs: 100 },
    );
    if (!refreshed) {
      throw apiError("terminal_not_ready", "Terminal session not ready");
    }
    session = refreshed;
  }

  await enforceRateLimit(limiter, identityId, "Too many commentary requests");
  const reservation = await reserveTokensOrThrow(
    redis,
    identityId,
    "commentary",
  );

  const personality = session.personality ?? "coach";
  const playerName = await getPlayerName(db, identityId);
  const model = resolveCommentaryModel(deps);
  const terminal =
    request.trigger === "terminal"
      ? terminalKindFromResult(session.result, session.moveHistory)
      : undefined;

  const system = buildAiSystemPrompt({
    personality,
    playerName,
    purpose: "commentary",
    ...(terminal !== undefined && { terminal }),
  });
  const userPrompt = buildCommentaryUserPrompt({
    board: session.board,
    moveHistory: session.moveHistory,
    result: session.result,
    trigger: request.trigger,
  });

  const sessionId = session.id;
  const result = streamText({
    model,
    system,
    prompt: userPrompt,
    maxOutputTokens: AI_MAX_OUTPUT_TOKENS.commentary,
    onError: ({ error }) => {
      log.warn("provider_error", { requestId, err: error });
    },
    onFinish: async ({ text, totalUsage }) => {
      const t = totalUsage?.totalTokens ?? 0;
      await settleReservation(redis, identityId, reservation, t);
      const { text: toPersist, usedFallback, reason } =
        selectPersistedCommentary(
          text,
          session.board,
          session.moveHistory,
          session.result,
          {
            terminalTrigger: request.trigger === "terminal",
          },
        );
      if (!toPersist) return;
      if (usedFallback) {
        await incrCommentaryHallucinationMetric(redis);
        log.info("validation_fallback", {
          requestId,
          sessionId,
          reason,
        });
      }
      await appendCommentaryLine(redis, sessionId, toPersist);
    },
  });

  return createTextStreamResponse({
    textStream: safeTextStream(result.textStream, {
      route: "ai/commentary",
      requestId,
    }),
    ...(requestId ? { headers: { "x-request-id": requestId } } : {}),
  });
}
