import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  MoveResponseSchema,
  ResignResponseSchema,
  StartGameResponseSchema,
  type Personality,
} from "@cheddr/api-types";
import {
  derivePhase,
  dtoToEngine,
  makeMove,
  type Difficulty,
  type GamePhase,
  type GameState,
  type Position,
} from "@cheddr/game-engine";

import { ApiError, apiGet, apiPost } from "@/lib/api";
import { haptics } from "@/lib/haptics";
import { ensureAnonIdentity } from "@/lib/auth";
import { Sentry } from "@/lib/sentry";

export interface UseRankedGameOptions {
  difficulty: Difficulty;
  ranked?: boolean;
  personality?: Personality;
}

interface RankedState {
  sessionId: string | null;
  /** Bumps only after server confirms a terminal game (move/resign); drives post-game commentary. */
  terminalAckVersion: number;
  gameState: GameState;
  phase: GamePhase;
  loading: boolean;
  /**
   * Last failure surfaced for this session. Preserved as an `Error` (often
   * an `ApiError` carrying status + requestId) so the UI can render details
   * like the request id without us having to hand-marshal every field.
   */
  error: Error | null;
  outcome: "win" | "loss" | "draw" | null;
  eloDelta: number | null;
  /** Set when the server reports a persisted game id (terminal move or resign). */
  gameId: string | null;
}

/**
 * Coerce an unknown thrown value into an `Error`. Strings/objects sometimes
 * leak through fetch wrappers; we keep `ApiError` instances intact so the
 * banner can pull `status`/`requestId` off them.
 */
function toError(err: unknown, fallbackMessage: string): Error {
  if (err instanceof Error) return err;
  if (typeof err === "string" && err.trim()) return new Error(err);
  return new Error(fallbackMessage);
}

const initialEngineState: GameState = {
  board: [null, null, null, null, null, null, null, null, null],
  currentPlayer: "X",
  moveHistory: [],
  result: { status: "in_progress" },
  difficulty: "beginner",
};

function cloneRankedState(s: RankedState): RankedState {
  return {
    ...s,
    terminalAckVersion: s.terminalAckVersion,
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
    terminalAckVersion: 0,
    gameState: { ...initialEngineState, difficulty },
    phase: "hydrating",
    loading: true,
    error: null,
    outcome: null,
    eloDelta: null,
    gameId: null,
  });

  // Mirror state into a ref so callbacks below can read the latest values
  // without taking `state` as a dependency. This keeps `playMove` stable
  // across state transitions (Board no longer needs to re-bind onCellPress
  // every render) while still surfacing fresh data inside the closure.
  const stateRef = useRef(state);
  stateRef.current = state;

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
        terminalAckVersion: 0,
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
        error: toError(err, "Failed to start game"),
      }));
    }
  }, [difficulty, ranked, personality]);

  useEffect(() => {
    void start();
  }, [start]);

  const playMove = useCallback(
    async (position: Position) => {
      const current = stateRef.current;
      if (!current.sessionId) return;
      if (current.phase !== "player_turn") return;

      const sessionIdAtStart = current.sessionId;
      const snapshot = cloneRankedState(current);

      let optimistic: GameState;
      try {
        optimistic = makeMove(current.gameState, position);
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
            terminalAckVersion: res.terminal
              ? s.terminalAckVersion + 1
              : s.terminalAckVersion,
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
            return { ...snapshot, error: err };
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
              terminalAckVersion: s.terminalAckVersion,
              gameState: engine,
              phase: derivePhase(engine),
              loading: false,
              error: toError(err, "Move failed — synced with server"),
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
              error: toError(err, "Move failed"),
            };
          });
        }
      }
    },
    [difficulty, invalidateAfterTerminal],
  );

  const resign = useCallback(async () => {
    const sessionId = stateRef.current.sessionId;
    if (!sessionId) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await apiPost(
        "/game/resign",
        { sessionId },
        ResignResponseSchema,
      );
      const engine = dtoToEngine(res.state);
      setState((s) => ({
        sessionId,
        terminalAckVersion: s.terminalAckVersion + 1,
        gameState: engine,
        phase: "game_over",
        loading: false,
        error: null,
        outcome: res.outcome,
        eloDelta: res.eloDelta,
        gameId: res.gameId,
      }));
      invalidateAfterTerminal();
    } catch (err) {
      try {
        const dto = await apiGet(
          `/game/${sessionId}/state`,
          StartGameResponseSchema,
        );
        const engine = dtoToEngine(dto);
        setState((s) => ({
          sessionId,
          terminalAckVersion: s.terminalAckVersion,
          gameState: engine,
          phase: derivePhase(engine),
          loading: false,
          error: toError(err, "Resign failed — synced with server"),
          outcome: null,
          eloDelta: null,
          gameId: null,
        }));
      } catch {
        setState((s) => ({
          ...s,
          loading: false,
          error: toError(err, "Resign failed"),
        }));
      }
    }
  }, [invalidateAfterTerminal]);

  return {
    ...state,
    isGameOver: state.phase === "game_over",
    playMove,
    resetGame: start,
    resign,
  };
}
