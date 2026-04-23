import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type {
  GameStateDTO,
  MoveResponse,
  Personality,
  ResignResponse,
  StartGameResponse,
} from "@cheddr/api-types";
import type { Difficulty, GameState, Position } from "@cheddr/game-engine";

import { ApiError, apiPost } from "@/lib/api";
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
  // counts. Whenever a ranked game terminates we invalidate the cached
  // profile so any subscribed screen — Home, Stats, Profile — re-fetches
  // and shows the up-to-date totals on its next render.
  const invalidateProfile = useCallback(() => {
    if (!ranked) return;
    void queryClient.invalidateQueries({ queryKey: ["user", "me"] });
  }, [queryClient, ranked]);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      // Make sure we have a usable bearer token before kicking off.
      await ensureAnonIdentity();
      const res = await apiPost<StartGameResponse>("/game/start", {
        difficulty,
        ranked,
        personality,
      });
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
      haptics.cellTap();
      setState((s) => ({ ...s, loading: true, phase: "ai_thinking" }));
      try {
        const res = await apiPost<MoveResponse>("/game/move", {
          sessionId: state.sessionId,
          position,
        });
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
          invalidateProfile();
        } else {
          haptics.pieceLanded();
        }
        setState({
          sessionId: state.sessionId,
          gameState: engine,
          phase: derivePhase(engine),
          loading: false,
          error: null,
          outcome: res.outcome,
          eloDelta: res.eloDelta,
          gameId: res.gameId ?? null,
        });
      } catch (err) {
        haptics.illegalTap();
        setState((s) => ({
          ...s,
          loading: false,
          phase: "player_turn",
          error: err instanceof ApiError ? err.message : "Move failed",
        }));
      }
    },
    [state.sessionId, state.phase, difficulty, invalidateProfile],
  );

  const resign = useCallback(async () => {
    if (!state.sessionId) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await apiPost<ResignResponse>("/game/resign", {
        sessionId: state.sessionId,
      });
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
      invalidateProfile();
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof ApiError ? err.message : "Resign failed",
      }));
    }
  }, [state.sessionId, invalidateProfile]);

  return {
    ...state,
    isGameOver: state.phase === "game_over",
    playMove,
    resetGame: start,
    resign,
  };
}
