import { describe, it, expect } from "vitest";
import { makeMove, checkResult, getValidMoves } from "../rules";
import { createGame } from "../board";
import type { Board, GameState, Position } from "../types";

function boardFromArray(cells: (string | null)[]): Board {
  return cells.map((c) => (c === "X" || c === "O" ? c : null)) as unknown as Board;
}

function stateWithBoard(
  board: Board,
  currentPlayer: "X" | "O" = "X",
): GameState {
  return {
    board,
    currentPlayer,
    moveHistory: [],
    result: checkResult(board),
    difficulty: "beginner",
  };
}

describe("getValidMoves", () => {
  it("returns all 9 positions for an empty board", () => {
    const board = boardFromArray([
      null, null, null,
      null, null, null,
      null, null, null,
    ]);
    expect(getValidMoves(board)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("excludes occupied positions", () => {
    const board = boardFromArray([
      "X", null, "O",
      null, "X", null,
      null, null, null,
    ]);
    expect(getValidMoves(board)).toEqual([1, 3, 5, 6, 7, 8]);
  });

  it("returns empty array for a full board", () => {
    const board = boardFromArray([
      "X", "O", "X",
      "X", "O", "O",
      "O", "X", "X",
    ]);
    expect(getValidMoves(board)).toEqual([]);
  });
});

describe("checkResult", () => {
  it("returns in_progress for an empty board", () => {
    const board = boardFromArray([
      null, null, null,
      null, null, null,
      null, null, null,
    ]);
    expect(checkResult(board)).toEqual({ status: "in_progress" });
  });

  it("returns in_progress for a partially filled board with no three-in-a-row", () => {
    const board = boardFromArray([
      "X", "O", null,
      null, "X", null,
      null, null, "O",
    ]);
    expect(checkResult(board)).toEqual({ status: "in_progress" });
  });

  it("returns loss for X when X completes top row", () => {
    const board = boardFromArray([
      "X", "X", "X",
      "O", "O", null,
      null, null, null,
    ]);
    expect(checkResult(board)).toEqual({ status: "loss", loser: "X" });
  });

  it("returns loss for O when O completes middle row", () => {
    const board = boardFromArray([
      "X", null, "X",
      "O", "O", "O",
      "X", null, null,
    ]);
    expect(checkResult(board)).toEqual({ status: "loss", loser: "O" });
  });

  it("returns loss for X when X completes bottom row", () => {
    const board = boardFromArray([
      "O", "O", null,
      null, null, null,
      "X", "X", "X",
    ]);
    expect(checkResult(board)).toEqual({ status: "loss", loser: "X" });
  });

  it("returns loss for O when O completes left column", () => {
    const board = boardFromArray([
      "O", "X", null,
      "O", "X", null,
      "O", null, null,
    ]);
    expect(checkResult(board)).toEqual({ status: "loss", loser: "O" });
  });

  it("returns loss for X when X completes center column", () => {
    const board = boardFromArray([
      "O", "X", null,
      null, "X", "O",
      null, "X", null,
    ]);
    expect(checkResult(board)).toEqual({ status: "loss", loser: "X" });
  });

  it("returns loss for O when O completes right column", () => {
    const board = boardFromArray([
      null, "X", "O",
      "X", null, "O",
      null, null, "O",
    ]);
    expect(checkResult(board)).toEqual({ status: "loss", loser: "O" });
  });

  it("returns loss for X when X completes main diagonal", () => {
    const board = boardFromArray([
      "X", "O", null,
      null, "X", "O",
      null, null, "X",
    ]);
    expect(checkResult(board)).toEqual({ status: "loss", loser: "X" });
  });

  it("returns loss for O when O completes anti-diagonal", () => {
    const board = boardFromArray([
      null, null, "O",
      "X", "O", "X",
      "O", null, null,
    ]);
    expect(checkResult(board)).toEqual({ status: "loss", loser: "O" });
  });

  it("returns draw when board is full with no three-in-a-row", () => {
    const board = boardFromArray([
      "X", "O", "X",
      "X", "O", "O",
      "O", "X", "X",
    ]);
    expect(checkResult(board)).toEqual({ status: "draw" });
  });
});

describe("makeMove", () => {
  it("places the current player's piece at the given position", () => {
    const state = createGame("beginner");
    const next = makeMove(state, 4);
    expect(next.board[4]).toBe("X");
  });

  it("alternates the current player after each move", () => {
    const state = createGame("beginner");
    const afterX = makeMove(state, 0);
    expect(afterX.currentPlayer).toBe("O");

    const afterO = makeMove(afterX, 1);
    expect(afterO.currentPlayer).toBe("X");
  });

  it("appends the position to moveHistory", () => {
    const state = createGame("beginner");
    const after1 = makeMove(state, 4);
    expect(after1.moveHistory).toEqual([4]);

    const after2 = makeMove(after1, 0);
    expect(after2.moveHistory).toEqual([4, 0]);
  });

  it("throws when moving to an occupied cell", () => {
    const state = createGame("beginner");
    const after = makeMove(state, 4);
    expect(() => makeMove(after, 4)).toThrow("occupied");
  });

  it("throws when the game is already over (loss)", () => {
    const board = boardFromArray([
      "X", "X", null,
      "O", "O", null,
      null, null, null,
    ]);
    const state: GameState = {
      board,
      currentPlayer: "X",
      moveHistory: [],
      result: { status: "in_progress" },
      difficulty: "beginner",
    };
    const afterLoss = makeMove(state, 2);
    expect(afterLoss.result).toEqual({ status: "loss", loser: "X" });
    expect(() => makeMove(afterLoss, 5)).toThrow("over");
  });

  it("detects a loss after a move that completes three-in-a-row", () => {
    const board = boardFromArray([
      "X", "X", null,
      "O", "O", null,
      null, null, null,
    ]);
    const state: GameState = {
      board,
      currentPlayer: "X",
      moveHistory: [0, 3, 1, 4],
      result: { status: "in_progress" },
      difficulty: "beginner",
    };
    const afterMove = makeMove(state, 2);
    expect(afterMove.result).toEqual({ status: "loss", loser: "X" });
  });

  it("detects a draw when the board fills with no three-in-a-row", () => {
    // Board before last move:
    // X O X
    // X O O
    // O X _
    const board = boardFromArray([
      "X", "O", "X",
      "X", "O", "O",
      "O", "X", null,
    ]);
    const state: GameState = {
      board,
      currentPlayer: "X",
      moveHistory: [],
      result: { status: "in_progress" },
      difficulty: "beginner",
    };
    const afterMove = makeMove(state, 8);
    expect(afterMove.result).toEqual({ status: "draw" });
  });

  it("does not mutate the original state", () => {
    const state = createGame("beginner");
    const next = makeMove(state, 4);
    expect(state.board[4]).toBeNull();
    expect(next.board[4]).toBe("X");
    expect(state.moveHistory).toEqual([]);
  });

  it("throws for an out-of-bounds position", () => {
    const state = createGame("beginner");
    expect(() => makeMove(state, 9 as Position)).toThrow();
    expect(() => makeMove(state, -1 as Position)).toThrow();
  });
});
