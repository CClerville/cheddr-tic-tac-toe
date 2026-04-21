import { useState, useCallback } from "react";
import {
  createGame,
  makeMove,
  getAiMove,
  type Difficulty,
  type GameState,
  type Position,
} from "@cheddr/game-engine";

export function useGame(initialDifficulty: Difficulty = "beginner") {
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [gameState, setGameState] = useState<GameState>(() =>
    createGame(difficulty),
  );

  const playMove = useCallback(
    (position: Position) => {
      if (gameState.result.status !== "in_progress") return;
      if (gameState.currentPlayer !== "X") return;

      try {
        const afterPlayer = makeMove(gameState, position);

        if (afterPlayer.result.status === "in_progress") {
          const aiPosition = getAiMove(afterPlayer);
          const afterAi = makeMove(afterPlayer, aiPosition);
          setGameState(afterAi);
        } else {
          setGameState(afterPlayer);
        }
      } catch {
        // Invalid move - ignore
      }
    },
    [gameState],
  );

  const resetGame = useCallback(() => {
    setGameState(createGame(difficulty));
  }, [difficulty]);

  const changeDifficulty = useCallback((newDifficulty: Difficulty) => {
    setDifficulty(newDifficulty);
    setGameState(createGame(newDifficulty));
  }, []);

  return {
    gameState,
    difficulty,
    playMove,
    resetGame,
    changeDifficulty,
  };
}
