import { describe, it, expect } from "vitest";
import { createBoard, createGame } from "../board";

describe("createBoard", () => {
  it("returns a 9-element tuple of all nulls", () => {
    const board = createBoard();
    expect(board).toHaveLength(9);
    expect(board.every((cell) => cell === null)).toBe(true);
  });
});

describe("createGame", () => {
  it("returns initial state with empty board and X going first", () => {
    const state = createGame("beginner");

    expect(state.board).toHaveLength(9);
    expect(state.board.every((cell) => cell === null)).toBe(true);
    expect(state.currentPlayer).toBe("X");
    expect(state.moveHistory).toEqual([]);
    expect(state.result).toEqual({ status: "in_progress" });
    expect(state.difficulty).toBe("beginner");
  });

  it("accepts all difficulty levels", () => {
    const beginner = createGame("beginner");
    const intermediate = createGame("intermediate");
    const expert = createGame("expert");

    expect(beginner.difficulty).toBe("beginner");
    expect(intermediate.difficulty).toBe("intermediate");
    expect(expert.difficulty).toBe("expert");
  });
});
