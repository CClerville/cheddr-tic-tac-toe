import { describe, expect, it } from "vitest";
import {
  BoardSchema,
  GameStateDTO,
  MoveRequestSchema,
  MoveResponseSchema,
  StartGameRequestSchema,
} from "../index";

describe("StartGameRequestSchema", () => {
  it("accepts valid input and defaults ranked to true", () => {
    const parsed = StartGameRequestSchema.parse({ difficulty: "expert" });
    expect(parsed.difficulty).toBe("expert");
    expect(parsed.ranked).toBe(true);
  });

  it("rejects invalid difficulty values", () => {
    expect(() =>
      StartGameRequestSchema.parse({ difficulty: "godlike" }),
    ).toThrow();
  });

  it("respects an explicit ranked=false", () => {
    const parsed = StartGameRequestSchema.parse({
      difficulty: "beginner",
      ranked: false,
    });
    expect(parsed.ranked).toBe(false);
  });
});

describe("MoveRequestSchema", () => {
  it("validates uuid and position bounds", () => {
    const ok = MoveRequestSchema.parse({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      position: 4,
    });
    expect(ok.position).toBe(4);
  });

  it("rejects positions outside [0, 8]", () => {
    expect(() =>
      MoveRequestSchema.parse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        position: 9,
      }),
    ).toThrow();
  });

  it("rejects non-uuid sessionId", () => {
    expect(() =>
      MoveRequestSchema.parse({ sessionId: "not-a-uuid", position: 0 }),
    ).toThrow();
  });
});

describe("BoardSchema", () => {
  it("requires exactly 9 cells", () => {
    expect(() => BoardSchema.parse([null, null, null])).toThrow();
    const board = BoardSchema.parse([
      "X", null, "O",
      null, "X", null,
      null, null, "O",
    ]);
    expect(board).toHaveLength(9);
  });

  it("only accepts X / O / null cells", () => {
    expect(() =>
      BoardSchema.parse([
        "X", "Y", null, null, null, null, null, null, null,
      ]),
    ).toThrow();
  });
});

describe("GameStateDTO", () => {
  it("accepts an in_progress state", () => {
    const parsed = GameStateDTO.parse({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      board: [null, null, null, null, null, null, null, null, null],
      currentPlayer: "X",
      moveHistory: [],
      result: { status: "in_progress" },
      difficulty: "intermediate",
      ranked: true,
      personality: "coach",
    });
    expect(parsed.result.status).toBe("in_progress");
  });

  it("requires loser when result is loss", () => {
    expect(() =>
      GameStateDTO.parse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        board: [null, null, null, null, null, null, null, null, null],
        currentPlayer: "X",
        moveHistory: [],
        result: { status: "loss" },
        difficulty: "expert",
        ranked: true,
        personality: "coach",
      }),
    ).toThrow();
  });
});

describe("MoveResponseSchema", () => {
  it("accepts a non-terminal response with no AI move", () => {
    const r = MoveResponseSchema.parse({
      state: {
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        board: ["X", null, null, null, null, null, null, null, null],
        currentPlayer: "O",
        moveHistory: [0],
        result: { status: "in_progress" },
        difficulty: "expert",
        ranked: true,
        personality: "coach",
      },
      aiMove: null,
      terminal: false,
      outcome: null,
      eloDelta: null,
      gameId: null,
    });
    expect(r.terminal).toBe(false);
  });
});
