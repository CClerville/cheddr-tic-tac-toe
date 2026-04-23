import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  MoveResponseSchema,
  ResignResponseSchema,
  StartGameResponseSchema,
  type GameStateDTO,
  type Personality,
} from "@cheddr/api-types";
import {
  makeMove,
  type Difficulty,
  type GameState,
  type Position,
} from "@cheddr/game-engine";

import { ApiError, apiGet, apiPost } from "@/lib/api";
import { haptics } from "@/lib/haptics";
import { ensureAnonIdentity } from "@/lib/auth";
import { Sentry } from "@/lib/sentry";
import type { GamePhase } from "./useGame";

export interface UseRankedGameOptions {
  difficulty: Difficulty;
  ranked?: boolean;
  personality?: Personality;
}

interface RankedState {
  sessionId: string | null;
  gameState: GameState;
  phase: GamePhase;
  loading: boolean;
  error: string | null;
  outcome: "win" | "loss" | "draw" | null;
  eloDelta: number | null;
  /** Set when the server reports a persisted game id (terminal move or resign). */
  gameId: string | null;
}

const initialEngineState: GameState = {
  board: [null, null, null, null, null, null, null, null, null],
  currentPlayer: "X",
  moveHistory: [],
  result: { status: "in_progress" },
  difficulty: "beginner",
};

function dtoToEngine(dto: GameStateDTO): GameState {
  return {
    board: [...dto.board] as unknown as GameState["board"],
    currentPlayer: dto.currentPlayer,
    moveHistory: [...dto.moveHistory],
    result: dto.result,
    difficulty: dto.difficulty,
  };
}

function derivePhase(state: GameState): GamePhase {
  if (state.result.status !== "in_progress") return "game_over";
  return state.currentPlayer === "X" ? "player_turn" : "ai_thinking";
}

function cloneRankedState(s: RankedState): RankedState {
  return {
    ...s,
    gameState: {
      ...s.gameState,
      board: [...s.gameState.board] as GameState["board"],
      moveHistory: [...s.gameState.moveHistory],
      result: s.gameState.result,
    },
  };
}

/**
 * Server-authoritative game hook. Mirrors the API surface of `useGame`
 * but every move is a network round-trip. The server generates the AI
 * move and persists terminal games.
 *
 * Designed for "Ranked" play; offline / unranked play continues to use
 * the local `useGame` hook to preserve a smooth offline experience.
 */
export function useRankedGame(options: UseRankedGameOptions) {
  const { difficulty, ranked = true, personality = "coach" } = options;
  const queryClient = useQueryClient();
  const [state, setState] = useState<RankedState>({
    sessionId: null,
    gameState: { ...initialEngineState, difficulty },
    phase: "hydrating",
    loading: true,
    error: null,
    outcome: null,
    eloDelta: null,
    gameId: null,
  });

  // Server profile (ELO + ranked W/L/D) is the canonical source for ranked
  // counts. The /user/stats endpoint splits ranked/casual by difficulty and
  // personality. Whenever a server-persisted game terminates (ranked OR
  // casual) we refresh stats; ranked games additionally bust /user/me so
  // ELO updates everywhere.
  const invalidateAfterTerminal = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["user", "stats"] });
    if (ranked) {
      void queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    }
  }, [queryClient, ranked]);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      // Make sure we have a usable bearer token before kicking off.
      await ensureAnonIdentity();
      const res = await apiPost("/game/start", {
        difficulty,
        ranked,
        personality,
      }, StartGameResponseSchema);
      const engine = dtoToEngine(res);
      setState({
        sessionId: res.sessionId,
        gameState: engine,
        phase: derivePhase(engine),
        loading: false,
        error: null,
        outcome: null,
        eloDelta: null,
        gameId: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof ApiError ? err.message : "Failed to start game",
      }));
    }
  }, [difficulty, ranked, personality]);

  useEffect(() => {
    void start();
  }, [start]);

  const playMove = useCallback(
    async (position: Position) => {
      if (!state.sessionId) return;
      if (state.phase !== "player_turn") return;

      const sessionIdAtStart = state.sessionId;
      const snapshot = cloneRankedState(state);

      let optimistic: GameState;
      try {
        optimistic = makeMove(state.gameState, position);
      } catch {
        haptics.illegalTap();
        return;
      }

      if (optimistic.result.status === "in_progress") {
        haptics.pieceLanded();
      }

      setState((s) => {
        if (s.sessionId !== sessionIdAtStart || s.phase !== "player_turn") {
          return s;
        }
        return {
          ...s,
          gameState: optimistic,
          phase: derivePhase(optimistic),
          loading: true,
          error: null,
        };
      });

      try {
        const res = await apiPost(
          "/game/move",
          {
            sessionId: sessionIdAtStart,
            position,
          },
          MoveResponseSchema,
        );
        const engine = dtoToEngine(res.state);
        if (res.terminal) {
          Sentry.addBreadcrumb({
            category: "game.terminal",
            message: `ranked game terminated: ${res.outcome}`,
            data: {
              difficulty,
              outcome: res.outcome,
              eloDelta: res.eloDelta,
              moves: engine.moveHistory.length,
            },
            level: "info",
          });
          if (res.outcome === "win") haptics.win();
          else if (res.outcome === "loss") haptics.loss();
          else if (res.outcome === "draw") haptics.draw();
          invalidateAfterTerminal();
        }
        // Non-terminal: pieceLanded already fired on optimistic apply.
        setState((s) => {
          if (s.sessionId !== sessionIdAtStart) return s;
          return {
            sessionId: sessionIdAtStart,
            gameState: engine,
            phase: derivePhase(engine),
            loading: false,
            error: null,
            outcome: res.outcome,
            eloDelta: res.eloDelta,
            gameId: res.gameId ?? null,
          };
        });
      } catch (err) {
        const isClientIllegalMove =
          err instanceof ApiError &&
          err.status === 400 &&
          /invalid|illegal|occupied|not allowed/i.test(err.message);
        if (isClientIllegalMove) {
          haptics.illegalTap();
          setState((s) => {
            if (s.sessionId !== sessionIdAtStart) return s;
            return { ...snapshot, error: err.message };
          });
          return;
        }
        haptics.illegalTap();
        try {
          const dto = await apiGet(
            `/game/${sessionIdAtStart}/state`,
            StartGameResponseSchema,
          );
          const engine = dtoToEngine(dto);
          setState((s) => {
            if (s.sessionId !== sessionIdAtStart) return s;
            return {
              sessionId: sessionIdAtStart,
              gameState: engine,
              phase: derivePhase(engine),
              loading: false,
              error:
                err instanceof ApiError
                  ? err.message
                  : "Move failed — synced with server",
              outcome: null,
              eloDelta: null,
              gameId: null,
            };
          });
        } catch {
          setState((s) => {
            if (s.sessionId !== sessionIdAtStart) return s;
            return {
              ...snapshot,
              error:
                err instanceof ApiError ? err.message : "Move failed",
            };
          });
        }
      }
    },
    [state, difficulty, invalidateAfterTerminal],
  );

  const resign = useCallback(async () => {
    if (!state.sessionId) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await apiPost("/game/resign", {
        sessionId: state.sessionId,
      }, ResignResponseSchema);
      const engine = dtoToEngine(res.state);
      setState({
        sessionId: state.sessionId,
        gameState: engine,
        phase: "game_over",
        loading: false,
        error: null,
        outcome: res.outcome,
        eloDelta: res.eloDelta,
        gameId: res.gameId,
      });
      invalidateAfterTerminal();
    } catch (err) {
      try {
        const dto = await apiGet(
          `/game/${state.sessionId}/state`,
          StartGameResponseSchema,
        );
        const engine = dtoToEngine(dto);
        setState({
          sessionId: state.sessionId,
          gameState: engine,
          phase: derivePhase(engine),
          loading: false,
          error:
            err instanceof ApiError
              ? err.message
              : "Resign failed — synced with server",
          outcome: null,
          eloDelta: null,
          gameId: null,
        });
      } catch {
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof ApiError ? err.message : "Resign failed",
        }));
      }
    }
  }, [state.sessionId, invalidateAfterTerminal]);

  return {
    ...state,
    isGameOver: state.phase === "game_over",
    playMove,
    resetGame: start,
    resign,
  };
}
