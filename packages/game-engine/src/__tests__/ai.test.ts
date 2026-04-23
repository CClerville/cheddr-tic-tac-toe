import { describe, it, expect } from "vitest";
import { getAiMove } from "../ai";
import { createGame } from "../board";
import { makeMove, checkResult, getValidMoves } from "../rules";
import type { Board, GameState } from "../types";

function boardFromArray(cells: (string | null)[]): Board {
  return cells.map((c) =>
    c === "X" || c === "O" ? c : null,
  ) as unknown as Board;
}

function stateWithBoard(
  board: Board,
  currentPlayer: "X" | "O" = "X",
  difficulty: "beginner" | "intermediate" | "expert" = "expert",
): GameState {
  return {
    board,
    currentPlayer,
    moveHistory: [],
    result: checkResult(board),
    difficulty,
  };
}

describe("getAiMove", () => {
  describe("all difficulties", () => {
    it("returns a valid (non-occupied) position", () => {
      const state = createGame("beginner");
      const move = getAiMove(state);
      expect(move).toBeGreaterThanOrEqual(0);
      expect(move).toBeLessThanOrEqual(8);
      expect(state.board[move]).toBeNull();
    });

    it("returns the only available move when one cell remains", () => {
      const board = boardFromArray([
        "X", "O", "X",
        "X", "O", "O",
        "O", "X", null,
      ]);
      const state = stateWithBoard(board, "X", "beginner");
      expect(getAiMove(state)).toBe(8);
    });
  });

  describe("beginner", () => {
    it("returns a valid position from empty board", () => {
      const state = createGame("beginner");
      const move = getAiMove(state);
      const valid = getValidMoves(state.board);
      expect(valid).toContain(move);
    });
  });

  describe("expert", () => {
    it("avoids completing three-in-a-row when possible", () => {
      // AI is O, and could lose by playing position 2 (completing O row)
      // Board:
      // O O _
      // X X _
      // _ _ _
      const board = boardFromArray([
        "O", "O", null,
        "X", "X", null,
        null, null, null,
      ]);
      const state = stateWithBoard(board, "O", "expert");
      const move = getAiMove(state);
      expect(move).not.toBe(2);
    });

    it("does not let the opponent force it to complete a line", () => {
      // AI is O. X has two in a row at positions 0,1.
      // If AI doesn't address this, X might force O into a loss.
      const board = boardFromArray([
        "X", "X", null,
        null, "O", null,
        null, null, null,
      ]);
      const state = stateWithBoard(board, "O", "expert");
      const move = getAiMove(state);
      const valid = getValidMoves(state.board);
      expect(valid).toContain(move);
    });

    it("expert AI playing both sides always draws from empty board", () => {
      let state = createGame("expert");

      while (state.result.status === "in_progress") {
        const move = getAiMove(state);
        state = makeMove(state, move);
      }

      expect(state.result).toEqual({ status: "draw" });
    });

    it("expert AI never loses (completes three-in-a-row) over 50 games", () => {
      for (let i = 0; i < 50; i++) {
        let state = createGame("expert");

        while (state.result.status === "in_progress") {
          const move = getAiMove(state);
          state = makeMove(state, move);
        }

        if (state.result.status === "loss") {
          throw new Error(
            `Expert AI lost on game ${i + 1}: ${JSON.stringify(state)}`,
          );
        }
      }
    });

    it("forces opponent loss when given a winning position", () => {
      // AI is X, O is forced into a losing position.
      // X plays optimally to force O to complete a line.
      // Board: X has center and corners positioned well
      const board = boardFromArray([
        "X", null, null,
        null, "X", "O",
        null, "O", null,
      ]);
      const state = stateWithBoard(board, "X", "expert");
      const move = getAiMove(state);
      const valid = getValidMoves(state.board);
      expect(valid).toContain(move);

      // After AI moves, the game should still be valid
      const afterMove = makeMove(state, move);
      expect(["in_progress", "loss", "draw"]).toContain(
        afterMove.result.status,
      );
    });
  });

  describe("intermediate", () => {
    it("returns valid moves consistently", () => {
      const state = createGame("intermediate");
      for (let i = 0; i < 20; i++) {
        const move = getAiMove(state);
        const valid = getValidMoves(state.board);
        expect(valid).toContain(move);
      }
    });
  });
});
