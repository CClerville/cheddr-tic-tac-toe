import { useCallback, useEffect, useRef, useState } from "react";

import {
  createGame,
  getAiMove,
  makeMove,
  type Difficulty,
  type GameState,
  type Position,
} from "@cheddr/game-engine";

import { haptics } from "@/lib/haptics";
import {
  gameRepository,
  outcomeFromResult,
  type GameRepository,
} from "@/storage/gameRepository";

export type GamePhase =
  | "hydrating"
  | "player_turn"
  | "ai_thinking"
  | "game_over";

export interface UseGameOptions {
  initialDifficulty?: Difficulty;
  /** Delay before the AI plays its move. Tunable for tests + reduced motion. */
  aiThinkDelayMs?: number;
  /** Repository override for tests. */
  repository?: GameRepository;
  /** Hydrate from persisted game on mount. */
  hydrate?: boolean;
}

const DEFAULT_AI_THINK_MS = 600;

function derivePhase(state: GameState): GamePhase {
  if (state.result.status !== "in_progress") return "game_over";
  return state.currentPlayer === "X" ? "player_turn" : "ai_thinking";
}

export function useGame(options: UseGameOptions | Difficulty = {}) {
  const opts: UseGameOptions =
    typeof options === "string" ? { initialDifficulty: options } : options;
  const {
    initialDifficulty = "beginner",
    aiThinkDelayMs = DEFAULT_AI_THINK_MS,
    repository = gameRepository,
    hydrate = true,
  } = opts;

  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [gameState, setGameState] = useState<GameState>(() =>
    createGame(initialDifficulty),
  );
  const [phase, setPhase] = useState<GamePhase>(
    hydrate ? "hydrating" : derivePhase(createGame(initialDifficulty)),
  );

  /**
   * Generation counter prevents stale AI moves from a previous game from
   * being applied after a reset / difficulty change. Bumped on every state
   * transition that would invalidate an in-flight AI think timer.
   */
  const generationRef = useRef(0);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (!hydrate) {
      setPhase(derivePhase(gameState));
      return;
    }
    let cancelled = false;
    repository
      .loadGame()
      .then((saved) => {
        if (cancelled) return;
        if (saved) {
          setGameState(saved);
          setDifficulty(saved.difficulty);
          if (saved.result.status !== "in_progress") {
            recordedRef.current = true;
          }
          setPhase(derivePhase(saved));
        } else {
          setPhase(derivePhase(gameState));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPhase(derivePhase(gameState));
      });
    return () => {
      cancelled = true;
    };
    // Hydration runs once on mount.
  }, []);

  useEffect(() => {
    if (phase === "hydrating") return;
    if (gameState.result.status === "in_progress") {
      void repository.saveGame(gameState);
    } else {
      void repository.clearGame();
      if (!recordedRef.current) {
        recordedRef.current = true;
        const outcome = outcomeFromResult(gameState.result);
        if (outcome) {
          void repository.recordResult(outcome, gameState.difficulty);
          if (outcome === "win") haptics.win();
          else if (outcome === "loss") haptics.loss();
          else haptics.draw();
        }
      }
    }
  }, [gameState, phase, repository]);

  useEffect(() => {
    if (phase !== "ai_thinking") return;
    const generation = ++generationRef.current;
    const timer = setTimeout(() => {
      if (generation !== generationRef.current) return;
      try {
        const aiPosition = getAiMove(gameState);
        const next = makeMove(gameState, aiPosition);
        haptics.pieceLanded();
        setGameState(next);
        setPhase(derivePhase(next));
      } catch {
        setPhase(derivePhase(gameState));
      }
    }, aiThinkDelayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [phase, gameState, aiThinkDelayMs]);

  const playMove = useCallback(
    (position: Position) => {
      if (phase !== "player_turn") return;
      try {
        const next = makeMove(gameState, position);
        setGameState(next);
        setPhase(derivePhase(next));
      } catch {
        haptics.illegalTap();
        // Ignore: invalid move (cell occupied or game over). The UI guards
        // against this via the `disabled` prop, but we defensively swallow
        // here so a stale tap during a phase transition cannot crash.
      }
    },
    [phase, gameState],
  );

  const resetGame = useCallback(() => {
    generationRef.current++;
    recordedRef.current = false;
    const fresh = createGame(difficulty);
    setGameState(fresh);
    setPhase(derivePhase(fresh));
  }, [difficulty]);

  const changeDifficulty = useCallback((newDifficulty: Difficulty) => {
    generationRef.current++;
    recordedRef.current = false;
    haptics.selectionChange();
    setDifficulty(newDifficulty);
    const fresh = createGame(newDifficulty);
    setGameState(fresh);
    setPhase(derivePhase(fresh));
  }, []);

  return {
    gameState,
    difficulty,
    phase,
    playMove,
    resetGame,
    changeDifficulty,
    isGameOver: gameState.result.status !== "in_progress",
    isHydrating: phase === "hydrating",
  };
}
