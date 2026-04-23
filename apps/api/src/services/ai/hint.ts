import type { Redis } from "@upstash/redis";
import type { HintRequest, HintResponse } from "@cheddr/api-types";

import type { AiLimitClient } from "../../lib/ai/rateLimit.js";
import { PositionSchema } from "@cheddr/api-types";
import {
  dtoToEngine,
  getBestMove,
  getValidMoves,
  type Position,
} from "@cheddr/game-engine";
import { generateObject } from "ai";
import { z } from "zod";

import {
  formatCellLegend,
  formatMoveHistory,
  serializeBoard,
} from "../../lib/ai/board.js";
import { AI_MAX_OUTPUT_TOKENS } from "../../lib/ai/constants.js";
import { resolveLanguageModel } from "../../lib/ai/gateway.js";
import { buildAiSystemPrompt } from "../../lib/ai/personalities.js";
import { apiError } from "../../lib/errors.js";
import { getPlayerName } from "../../lib/users.js";
import { getSession } from "../../lib/session.js";
import type { AppDeps } from "../../types.js";

import {
  enforceRateLimit,
  reserveTokensOrThrow,
  settleReservation,
} from "./common.js";

const HintObjectSchema = z.object({
  position: PositionSchema,
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
});

export interface HintServiceParams {
  readonly identityId: string;
  readonly request: HintRequest;
}

export interface HintServiceDeps {
  readonly deps: AppDeps;
  readonly redis: Redis;
  readonly db: AppDeps["db"];
  readonly limiter: AiLimitClient;
}

/**
 * Suggest a single move for the human player.
 *
 * Falls back to the deterministic engine pick when the model either
 * proposes an illegal cell or fails outright — this guarantees the
 * client always sees a usable hint instead of an error UI, while
 * `fellBackToEngine` lets the UI hide LLM-flavored copy.
 */
export async function generateHint(
  { deps, redis, db, limiter }: HintServiceDeps,
  { identityId, request }: HintServiceParams,
): Promise<HintResponse> {
  const session = await getSession(redis, request.sessionId);
  if (!session || session.userId !== identityId) {
    throw apiError("session_not_found", "Session not found or expired");
  }
  if (session.result.status !== "in_progress") {
    throw apiError("game_not_in_progress", "Game is not in progress");
  }
  if (session.currentPlayer !== "X") {
    throw apiError("not_your_turn", "Hints are only available on your turn");
  }

  await enforceRateLimit(limiter, identityId, "Too many hint requests");
  const reservation = await reserveTokensOrThrow(redis, identityId, "hint");

  const engineState = dtoToEngine(session);
  const legal = getValidMoves(session.board);
  const legalSet = new Set<Position>(legal);

  const playerName = await getPlayerName(db, identityId);
  const model = resolveLanguageModel(deps);
  const playerLabel = playerName ?? "the player";
  const system = [
    buildAiSystemPrompt({
      personality: session.personality ?? "coach",
      playerName,
      purpose: "hint",
    }),
    `Suggest a single cell index 0-8 for ${playerLabel} (X) to play next.`,
    `Legal moves right now: ${legal.join(", ")}.`,
    `You MUST pick one of the legal moves.`,
  ].join(" ");

  const userPrompt = [
    formatCellLegend(),
    ``,
    `Board:`,
    serializeBoard(session.board),
    `Move history:`,
    formatMoveHistory(session.moveHistory),
  ].join("\n");

  let position: Position;
  let reasoning: string;
  let confidence: number;
  let fellBackToEngine = false;

  try {
    const { object, usage } = await generateObject({
      model,
      schema: HintObjectSchema,
      system,
      prompt: userPrompt,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS.hint,
    });
    await settleReservation(
      redis,
      identityId,
      reservation,
      usage?.totalTokens ?? 0,
    );

    if (!legalSet.has(object.position)) {
      fellBackToEngine = true;
      position = getBestMove(engineState);
      reasoning =
        "Cheddr glitched on that pick — grabbing the engine's strongest legal move instead.";
      confidence = 0;
    } else {
      position = object.position;
      reasoning = object.reasoning;
      confidence = object.confidence;
    }
  } catch {
    await settleReservation(redis, identityId, reservation, 0);
    fellBackToEngine = true;
    position = getBestMove(engineState);
    reasoning =
      "Cheddr's momentarily offline — defaulting to the engine's best legal move.";
    confidence = 0;
  }

  return { position, reasoning, confidence, fellBackToEngine };
}
