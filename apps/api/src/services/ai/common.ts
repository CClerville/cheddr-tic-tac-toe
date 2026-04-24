import type { Redis } from "@upstash/redis";
import type { HTTPException } from "hono/http-exception";

import type { AiLimitClient } from "../../lib/ai/rateLimit.js";
import { AI_TOKEN_RESERVE } from "../../lib/ai/constants.js";
import {
  dailyTokenBudget,
  globalDailyTokenBudget,
  settleAiTokenReservation,
  tryReserveAiTokens,
} from "../../lib/ai/usage.js";
import { apiError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

const log = logger.child({ scope: "ai" });

/**
 * Handle returned by `reserveTokensOrThrow`. The caller passes this back
 * to `settleReservation` once the model has reported actual usage.
 */
export interface AiTokenReservation {
  readonly reserved: number;
}

/**
 * Build a 429 with a sensible Retry-After header.
 *
 * Centralized here because all three AI services emit the exact same
 * shape — keeping it in one place means a future schema change (e.g.
 * adding a per-route hint to the body) only happens once.
 */
export function rateLimitedResponse(
  message: string,
  retryAfterSeconds: number,
): HTTPException {
  return apiError("rate_limited", message, {
    headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) },
  });
}

/**
 * Apply a rate limiter and translate a deny into the canonical 429.
 *
 * `void rl.pending` is intentional — Upstash queues background metric
 * writes that we don't want to await on the hot path but must reference
 * so the Promise isn't garbage-collected and lost.
 */
export async function enforceRateLimit(
  limiter: AiLimitClient,
  identityId: string,
  message: string,
): Promise<void> {
  const rl = await limiter.limit(identityId);
  void rl.pending;
  if (!rl.success) {
    throw rateLimitedResponse(
      message,
      Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)),
    );
  }
}

export type AiServiceKind = keyof typeof AI_TOKEN_RESERVE;

/**
 * Reserve tokens for an upcoming AI call, otherwise reject with the
 * canonical quota error. Returns the reservation handle the caller must
 * settle once the actual usage is known.
 */
export async function reserveTokensOrThrow(
  redis: Redis,
  identityId: string,
  kind: AiServiceKind,
): Promise<AiTokenReservation> {
  const result = await tryReserveAiTokens(
    redis,
    identityId,
    AI_TOKEN_RESERVE[kind],
    dailyTokenBudget(),
    globalDailyTokenBudget(),
  );
  if (!result.ok) {
    throw apiError("ai_quota_exceeded", "AI daily quota exceeded");
  }
  return { reserved: result.reserved };
}

/**
 * Settle a token reservation against actual usage. Wraps the underlying
 * helper so route code never has to remember the parameter order.
 */
export function settleReservation(
  redis: Redis,
  identityId: string,
  reservation: AiTokenReservation,
  actualTokens: number,
): Promise<void> {
  return settleAiTokenReservation(
    redis,
    identityId,
    reservation.reserved,
    actualTokens,
  );
}

/**
 * Wrap an AI SDK text stream so any mid-stream rejection is swallowed
 * (logged) instead of escalating to an unhandled promise rejection.
 *
 * Headers have already flushed by the time we start iterating, so the
 * only graceful option is to end the stream early; the client sees a
 * short/empty body instead of a crash. This was historically the cause
 * of intermittent CDN 502s when an upstream LLM session timed out.
 */
export function safeTextStream(
  source: ReadableStream<string>,
  context: { route: string; requestId: string | undefined },
): ReadableStream<string> {
  const reader = source.getReader();
  let closed = false;
  // Closing a controller that has already terminated (e.g. because the
  // consumer cancelled while a `pull` was in flight) throws synchronously.
  // We only ever want to close once, regardless of which path got here.
  const closeOnce = (controller: ReadableStreamDefaultController<string>) => {
    if (closed) return;
    closed = true;
    try {
      controller.close();
    } catch {
      /* controller already terminated by cancel(); nothing to do */
    }
  };
  return new ReadableStream<string>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          closeOnce(controller);
          return;
        }
        controller.enqueue(value);
      } catch (err) {
        log.warn("stream_aborted", {
          route: context.route,
          requestId: context.requestId,
          err,
        });
        closeOnce(controller);
      }
    },
    cancel(reason) {
      closed = true;
      reader.cancel(reason).catch(() => {});
    },
  });
}
