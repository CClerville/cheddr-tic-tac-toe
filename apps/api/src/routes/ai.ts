import { zValidator } from "@hono/zod-validator";
import {
  AnalysisRequestSchema,
  AnalysisResponseSchema,
  CommentaryRequestSchema,
  HintRequestSchema,
  type HintResponse,
  PositionSchema,
} from "@cheddr/api-types";
import { schema } from "@cheddr/db";
import {
  getBestMove,
  getValidMoves,
  type GameState,
  type Position,
} from "@cheddr/game-engine";
import { createTextStreamResponse, generateObject, streamText } from "ai";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { resolveLanguageModel } from "../lib/ai/gateway.js";
import { formatMoveHistory, serializeBoard } from "../lib/ai/board.js";
import { personalitySystemPrompt } from "../lib/ai/personalities.js";
import { resolveAiLimiters } from "../lib/ai/rateLimit.js";
import {
  dailyTokenBudget,
  globalDailyTokenBudget,
  settleAiTokenReservation,
  tryReserveAiTokens,
} from "../lib/ai/usage.js";
import { setGameAiAnalysis } from "../lib/persist.js";
import {
  appendCommentaryLine,
  getSession,
  loadSessionOrSnapshotForAi,
} from "../lib/session.js";
import { auth } from "../middleware/auth.js";
import type { AppBindings, AppDeps } from "../types.js";

const HintObjectSchema = z.object({
  position: PositionSchema,
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
});

function rateLimitedResponse(
  message: string,
  retryAfterSeconds: number,
): HTTPException {
  return new HTTPException(429, {
    res: new Response(
      JSON.stringify({ error: "rate_limited", message }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.max(1, retryAfterSeconds)),
        },
      },
    ),
  });
}

/**
 * Wrap an AI SDK text stream so any mid-stream rejection is swallowed
 * (logged) instead of escalating to an unhandled promise rejection.
 * Headers have already flushed by the time we start iterating, so the
 * only graceful option is to end the stream early; the client sees a
 * short/empty body instead of a crash.
 */
function safeTextStream(
  source: ReadableStream<string>,
  context: { route: string; requestId: string | undefined },
): ReadableStream<string> {
  const reader = source.getReader();
  return new ReadableStream<string>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (err) {
        console.warn(`[${context.route}] stream aborted`, {
          requestId: context.requestId,
          err,
        });
        controller.close();
      }
    },
    cancel(reason) {
      reader.cancel(reason).catch(() => {});
    },
  });
}

function toEngineState(session: {
  board: GameState["board"];
  currentPlayer: GameState["currentPlayer"];
  moveHistory: GameState["moveHistory"];
  result: GameState["result"];
  difficulty: GameState["difficulty"];
}): GameState {
  return {
    board: session.board,
    currentPlayer: session.currentPlayer,
    moveHistory: [...session.moveHistory],
    result: session.result,
    difficulty: session.difficulty,
  };
}

export function createAiRoutes(deps: AppDeps) {
  const { db, redis, clerkSecretKey, jwtSecret } = deps;
  const requireAuth = auth({ db, clerkSecretKey, jwtSecret });
  const limiters = resolveAiLimiters(redis, deps.aiLimiters);

  return new Hono<AppBindings>()
    .use("*", requireAuth)

    .post("/commentary", zValidator("json", CommentaryRequestSchema), async (c) => {
      const identity = c.get("identity");
      const body = c.req.valid("json");
      const session = await loadSessionOrSnapshotForAi(redis, body.sessionId);
      if (!session || session.userId !== identity.id) {
        throw new HTTPException(404, { message: "Session not found or expired" });
      }

      const rl = await limiters.commentary.limit(identity.id);
      void rl.pending;
      if (!rl.success) {
        throw rateLimitedResponse(
          "Too many commentary requests",
          Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)),
        );
      }

      const reserveAmount = 200;
      const reserveResult = await tryReserveAiTokens(
        redis,
        identity.id,
        reserveAmount,
        dailyTokenBudget(),
        globalDailyTokenBudget(),
      );
      if (!reserveResult.ok) {
        throw new HTTPException(402, { message: "ai_quota_exceeded" });
      }

      const personality = session.personality ?? "coach";
      const model = resolveLanguageModel(deps);
      const system = personalitySystemPrompt(personality);
      const userPrompt = [
        `Board (cells 0-8, rows top-to-bottom):`,
        serializeBoard(session.board),
        ``,
        `Move log:`,
        formatMoveHistory(session.moveHistory),
        ``,
        `Game result JSON: ${JSON.stringify(session.result)}`,
        `Trigger: ${body.trigger}`,
        ``,
        `Respond with one or two short sentences of live commentary only. No bullet lists.`,
      ].join("\n");

      const rid = c.get("requestId");
      const sessionId = session.id;
      const result = streamText({
        model,
        system,
        prompt: userPrompt,
        maxOutputTokens: 120,
        onError: ({ error }) => {
          console.warn("[ai/commentary] provider error", {
            requestId: rid,
            error,
          });
        },
        onFinish: async ({ text, totalUsage }) => {
          const t = totalUsage?.totalTokens ?? 0;
          await settleAiTokenReservation(
            redis,
            identity.id,
            reserveResult.reserved,
            t,
          );
          if (text.trim()) {
            await appendCommentaryLine(redis, sessionId, text);
          }
        },
      });

      return createTextStreamResponse({
        textStream: safeTextStream(result.textStream, {
          route: "ai/commentary",
          requestId: rid,
        }),
        headers: rid ? { "x-request-id": rid } : undefined,
      });
    })

    .post("/hint", zValidator("json", HintRequestSchema), async (c) => {
      const identity = c.get("identity");
      const { sessionId } = c.req.valid("json");
      const session = await getSession(redis, sessionId);
      if (!session || session.userId !== identity.id) {
        throw new HTTPException(404, { message: "Session not found or expired" });
      }
      if (session.result.status !== "in_progress") {
        throw new HTTPException(409, { message: "Game is not in progress" });
      }
      if (session.currentPlayer !== "X") {
        throw new HTTPException(409, { message: "Hints are only available on your turn" });
      }

      const rl = await limiters.hint.limit(identity.id);
      void rl.pending;
      if (!rl.success) {
        throw rateLimitedResponse(
          "Too many hint requests",
          Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)),
        );
      }

      const reserveAmount = 250;
      const reserveResult = await tryReserveAiTokens(
        redis,
        identity.id,
        reserveAmount,
        dailyTokenBudget(),
        globalDailyTokenBudget(),
      );
      if (!reserveResult.ok) {
        throw new HTTPException(402, { message: "ai_quota_exceeded" });
      }

      const engineState = toEngineState(session);
      const legal = getValidMoves(session.board);
      const legalSet = new Set<Position>(legal);

      const model = resolveLanguageModel(deps);
      const system = [
        personalitySystemPrompt(session.personality ?? "coach"),
        `Suggest a single cell index 0-8 for the human (X) to play next.`,
        `Legal moves right now: ${legal.join(", ")}.`,
        `You MUST pick one of the legal moves.`,
      ].join(" ");

      const userPrompt = [
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
          maxOutputTokens: 200,
        });
        await settleAiTokenReservation(
          redis,
          identity.id,
          reserveResult.reserved,
          usage?.totalTokens ?? 0,
        );

        if (!legalSet.has(object.position)) {
          fellBackToEngine = true;
          position = getBestMove(engineState);
          reasoning =
            "The model suggested an illegal move; using the engine's strongest legal reply instead.";
          confidence = 0;
        } else {
          position = object.position;
          reasoning = object.reasoning;
          confidence = object.confidence;
        }
      } catch {
        await settleAiTokenReservation(
          redis,
          identity.id,
          reserveResult.reserved,
          0,
        );
        fellBackToEngine = true;
        position = getBestMove(engineState);
        reasoning =
          "AI hint is temporarily unavailable; using the engine's strongest legal move instead.";
        confidence = 0;
      }

      const resBody: HintResponse = {
        position,
        reasoning,
        confidence,
        fellBackToEngine,
      };
      return c.json(resBody);
    })

    .post("/analysis", zValidator("json", AnalysisRequestSchema), async (c) => {
      const identity = c.get("identity");
      const { gameId } = c.req.valid("json");

      const [game] = await db
        .select()
        .from(schema.games)
        .where(
          and(eq(schema.games.id, gameId), eq(schema.games.userId, identity.id)),
        )
        .limit(1);

      if (!game) {
        throw new HTTPException(404, { message: "Game not found" });
      }

      if (game.aiAnalysis != null) {
        const parsed = AnalysisResponseSchema.safeParse(game.aiAnalysis);
        if (parsed.success) {
          return c.json(parsed.data);
        }
      }

      const rl = await limiters.analysis.limit(identity.id);
      void rl.pending;
      if (!rl.success) {
        throw rateLimitedResponse(
          "Too many analysis requests",
          Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)),
        );
      }

      const reserveAmount = 900;
      const reserveResult = await tryReserveAiTokens(
        redis,
        identity.id,
        reserveAmount,
        dailyTokenBudget(),
        globalDailyTokenBudget(),
      );
      if (!reserveResult.ok) {
        throw new HTTPException(402, { message: "ai_quota_exceeded" });
      }

      const model = resolveLanguageModel(deps);
      const system = [
        `You analyze a completed Misere tic-tac-toe game.`,
        `Human is X, AI is O. Three in a row loses for the player who completes the line.`,
        `The stored result is from the human's perspective: win / loss / draw.`,
        `Return JSON matching the schema: a short summary and a list of turns with moveIndex 1..n matching each played move in order, severity, and a one-line comment.`,
      ].join(" ");

      const userPrompt = [
        `Difficulty: ${game.difficulty}`,
        `Outcome for human: ${game.result}`,
        `Move sequence (0-8 cells): ${JSON.stringify(game.moveHistory)}`,
      ].join("\n");

      let object: z.infer<typeof AnalysisResponseSchema>;
      let usage: { totalTokens?: number } | undefined;
      try {
        ({ object, usage } = await generateObject({
          model,
          schema: AnalysisResponseSchema,
          system,
          prompt: userPrompt,
          maxOutputTokens: 800,
        }));
      } catch (err) {
        await settleAiTokenReservation(
          redis,
          identity.id,
          reserveResult.reserved,
          0,
        );
        console.warn("[ai/analysis] provider error", {
          requestId: c.get("requestId"),
          err,
        });
        throw new HTTPException(503, { message: "ai_unavailable" });
      }

      await settleAiTokenReservation(
        redis,
        identity.id,
        reserveResult.reserved,
        usage?.totalTokens ?? 0,
      );

      const saved = await setGameAiAnalysis(db, {
        gameId,
        userId: identity.id,
        analysis: object,
      });
      if (!saved) {
        throw new HTTPException(500, { message: "Failed to persist analysis" });
      }

      return c.json(object);
    });
}
