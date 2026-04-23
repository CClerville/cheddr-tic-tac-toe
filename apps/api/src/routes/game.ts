import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  type GameStateDTO as GameStateDtoType,
  MoveRequestSchema,
  type MoveResponse,
  ResignRequestSchema,
  type ResignResponse,
  StartGameRequestSchema,
  type StartGameResponse,
} from "@cheddr/api-types";
import {
  createGame,
  getAiMove,
  makeMove,
  type GameResult,
  type Position,
} from "@cheddr/game-engine";

import { apiError } from "../lib/errors.js";
import { auth } from "../middleware/auth.js";
import {
  createSession,
  deleteSession,
  getSession,
  saveCompletedSessionForAi,
  updateSession,
  withSessionMoveLock,
  type GameSession,
} from "../lib/session.js";
import { outcomeForPlayer, persistTerminalGame } from "../lib/persist.js";
import type { AppBindings, AppDeps } from "../types.js";

function sessionToDto(session: GameSession): GameStateDtoType {
  return {
    sessionId: session.id,
    board: session.board,
    currentPlayer: session.currentPlayer,
    moveHistory: session.moveHistory,
    result: session.result,
    difficulty: session.difficulty,
    ranked: session.ranked,
    personality: session.personality ?? "coach",
  };
}

/**
 * Build a fully-applied AI loss when the player resigns. The Misere model
 * doesn't have a "resign" outcome natively, so we synthesize one by
 * marking the resigning player (X) as the loser.
 */
function resignAsLoss(): GameResult {
  return { status: "loss", loser: "X" };
}

export function createGameRoutes(deps: AppDeps) {
  const { db, redis, clerkSecretKey, jwtSecret } = deps;
  const requireAuth = auth({ db, clerkSecretKey, jwtSecret });

  return new Hono<AppBindings>()
    .use("*", requireAuth)

    .post("/start", zValidator("json", StartGameRequestSchema), async (c) => {
      const { difficulty, ranked, personality } = c.req.valid("json");
      const identity = c.get("identity");

      const initial = createGame(difficulty);
      const session: GameSession = {
        id: crypto.randomUUID(),
        userId: identity.id,
        ranked,
        startedAt: Date.now(),
        board: initial.board,
        currentPlayer: initial.currentPlayer,
        moveHistory: [...initial.moveHistory],
        result: initial.result,
        difficulty,
        personality,
      };

      await createSession(redis, session);

      const body: StartGameResponse = sessionToDto(session);
      return c.json(body);
    })

    .post("/move", zValidator("json", MoveRequestSchema), async (c) => {
      const { sessionId, position } = c.req.valid("json");
      const identity = c.get("identity");

      return await withSessionMoveLock(redis, sessionId, async () => {
        const session = await getSession(redis, sessionId);
        if (!session) {
          throw apiError("session_not_found", "Session not found or expired");
        }
        if (session.userId !== identity.id) {
          throw apiError("forbidden", "Session belongs to another user");
        }
        if (session.result.status !== "in_progress") {
          throw apiError("game_not_in_progress", "Game is already over");
        }
        if (session.currentPlayer !== "X") {
          throw apiError("not_your_turn", "Not the player's turn");
        }

        let next;
        try {
          next = makeMove(
            {
              board: session.board,
              currentPlayer: session.currentPlayer,
              moveHistory: session.moveHistory,
              result: session.result,
              difficulty: session.difficulty,
            },
            position as Position,
          );
        } catch (err) {
          throw apiError(
            "invalid_move",
            err instanceof Error ? err.message : "Invalid move",
          );
        }

        let aiMove: Position | null = null;
        // If the player's move didn't end the game, the AI plays right away.
        if (next.result.status === "in_progress" && next.currentPlayer === "O") {
          aiMove = getAiMove(next);
          next = makeMove(next, aiMove);
        }

        // Mutate session in place with the latest engine state.
        session.board = next.board;
        session.currentPlayer = next.currentPlayer;
        session.moveHistory = [...next.moveHistory];
        session.result = next.result;

        const terminal = session.result.status !== "in_progress";

        let eloDelta: number | null = null;
        let outcome: ReturnType<typeof outcomeForPlayer> | null = null;
        let gameId: string | null = null;

        if (terminal) {
          const persisted = await persistTerminalGame(db, redis, {
            userId: session.userId,
            difficulty: session.difficulty,
            result: session.result,
            moveHistory: session.moveHistory,
            ranked: session.ranked,
            personality: session.personality ?? null,
            durationMs: Date.now() - session.startedAt,
          });
          outcome = persisted.outcome;
          eloDelta = persisted.eloDelta;
          gameId = persisted.gameId;
          await saveCompletedSessionForAi(redis, session);
          await deleteSession(redis, session.id);
        } else {
          await updateSession(redis, session);
        }

        const body: MoveResponse = {
          state: sessionToDto(session),
          aiMove,
          terminal,
          outcome,
          eloDelta,
          gameId,
        };
        return c.json(body);
      });
    })

    .post("/resign", zValidator("json", ResignRequestSchema), async (c) => {
      const { sessionId } = c.req.valid("json");
      const identity = c.get("identity");

      return await withSessionMoveLock(redis, sessionId, async () => {
        const session = await getSession(redis, sessionId);
        if (!session) {
          throw apiError("session_not_found", "Session not found or expired");
        }
        if (session.userId !== identity.id) {
          throw apiError("forbidden", "Session belongs to another user");
        }
        if (session.result.status !== "in_progress") {
          throw apiError("game_not_in_progress", "Game is already over");
        }

        session.result = resignAsLoss();

        const persisted = await persistTerminalGame(db, redis, {
          userId: session.userId,
          difficulty: session.difficulty,
          result: session.result,
          moveHistory: session.moveHistory,
          ranked: session.ranked,
          personality: session.personality ?? null,
          durationMs: Date.now() - session.startedAt,
        });
        await saveCompletedSessionForAi(redis, session);
        await deleteSession(redis, session.id);

        const body: ResignResponse = {
          state: sessionToDto(session),
          outcome: persisted.outcome,
          eloDelta: persisted.eloDelta,
          gameId: persisted.gameId,
        };
        return c.json(body);
      });
    })

    .get(
      "/:id/state",
      zValidator("param", z.object({ id: z.string().uuid() })),
      async (c) => {
        const { id } = c.req.valid("param");
        const identity = c.get("identity");
        const session = await getSession(redis, id);
        if (!session) {
          throw apiError("session_not_found", "Session not found or expired");
        }
        if (session.userId !== identity.id) {
          throw apiError("forbidden", "Session belongs to another user");
        }
        return c.json(sessionToDto(session));
      },
    );
}
