import type { Redis } from "@upstash/redis";
import type {
  AnalysisRequest,
  AnalysisResponse,
} from "@cheddr/api-types";

import type { AiLimitClient } from "../../lib/ai/rateLimit.js";
import { AnalysisResponseSchema } from "@cheddr/api-types";
import { schema } from "@cheddr/db";
import { generateObject } from "ai";
import { and, eq } from "drizzle-orm";

import {
  formatCellLegend,
} from "../../lib/ai/board.js";
import { AI_MAX_OUTPUT_TOKENS } from "../../lib/ai/constants.js";
import { resolveLanguageModel } from "../../lib/ai/gateway.js";
import { buildAiSystemPrompt } from "../../lib/ai/personalities.js";
import { apiError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { setGameAiAnalysis } from "../../lib/persist.js";
import { getPlayerName } from "../../lib/users.js";
import type { AppDeps } from "../../types.js";

const log = logger.child({ scope: "ai/analysis" });

import {
  enforceRateLimit,
  reserveTokensOrThrow,
  settleReservation,
} from "./common.js";

export interface AnalysisServiceParams {
  readonly identityId: string;
  readonly request: AnalysisRequest;
  readonly requestId: string | undefined;
}

export interface AnalysisServiceDeps {
  readonly deps: AppDeps;
  readonly redis: Redis;
  readonly db: AppDeps["db"];
  readonly limiter: AiLimitClient;
}

/**
 * Generate (or replay cached) post-game analysis for a finished game.
 *
 * The first successful call persists the analysis JSON onto the game
 * row; every subsequent call short-circuits to the cached value, which
 * is why the rate limit + token reservation only fire on cache miss.
 */
export async function generateAnalysis(
  { deps, redis, db, limiter }: AnalysisServiceDeps,
  { identityId, request, requestId }: AnalysisServiceParams,
): Promise<AnalysisResponse> {
  const [game] = await db
    .select()
    .from(schema.games)
    .where(
      and(eq(schema.games.id, request.gameId), eq(schema.games.userId, identityId)),
    )
    .limit(1);

  if (!game) {
    throw apiError("not_found", "Game not found");
  }

  if (game.aiAnalysis != null) {
    const parsed = AnalysisResponseSchema.safeParse(game.aiAnalysis);
    if (parsed.success) {
      return parsed.data;
    }
  }

  await enforceRateLimit(limiter, identityId, "Too many analysis requests");
  const reservation = await reserveTokensOrThrow(redis, identityId, "analysis");

  const playerName = await getPlayerName(db, identityId);
  const model = resolveLanguageModel(deps);
  const playerLabel = playerName ?? "The player";
  const system = [
    buildAiSystemPrompt({
      personality: "coach",
      playerName,
      purpose: "analysis",
    }),
    `You are reviewing a finished game. You played O. ${playerLabel} played X.`,
    `Three in a row loses for whoever completes the line.`,
    `The stored result is from the player's perspective: win / loss / draw.`,
    `Return JSON matching the schema: a short summary and a list of turns with moveIndex 1..n matching each played move in order, severity, and a one-line comment.`,
  ].join(" ");

  const userPrompt = [
    formatCellLegend(),
    ``,
    `Difficulty: ${game.difficulty}`,
    `Outcome for ${playerLabel} (win / loss / draw from their perspective): ${game.result}`,
    `Move sequence (0-8 cells): ${JSON.stringify(game.moveHistory)}`,
  ].join("\n");

  let object: AnalysisResponse;
  let usage: { totalTokens?: number | undefined } | undefined;
  try {
    ({ object, usage } = await generateObject({
      model,
      schema: AnalysisResponseSchema,
      system,
      prompt: userPrompt,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS.analysis,
    }));
  } catch (err) {
    await settleReservation(redis, identityId, reservation, 0);
    log.warn("provider_error", { requestId, err });
    throw apiError("ai_unavailable", "AI analysis temporarily unavailable");
  }

  await settleReservation(
    redis,
    identityId,
    reservation,
    usage?.totalTokens ?? 0,
  );

  const saved = await setGameAiAnalysis(db, {
    gameId: request.gameId,
    userId: identityId,
    analysis: object,
  });
  if (!saved) {
    throw apiError("ai_persist_failed", "Failed to persist analysis");
  }

  return object;
}
