import { describe, expect, it } from "vitest";

import type { Board } from "@cheddr/game-engine";

import {
  commentaryFallbackLine,
  extractReferencedCells,
  selectPersistedCommentary,
  validateCommentary,
} from "../lib/ai/commentaryGuard.js";

const emptyBoard: Board = [
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];

describe("extractReferencedCells", () => {
  it("finds one label case-insensitively", () => {
    expect(extractReferencedCells("Nice play at Middle-Right!")).toEqual([5]);
  });

  it("dedupes repeated labels", () => {
    expect(extractReferencedCells("center and center again")).toEqual([4]);
  });

  it("returns multiple distinct cells", () => {
    expect(
      extractReferencedCells("From top-left to bottom-right"),
    ).toEqual([0, 8]);
  });
});

describe("validateCommentary", () => {
  it("flags phantom_cell when center is empty but text names center", () => {
    const board: Board = [
      "O",
      null,
      null,
      null,
      null,
      "X",
      null,
      null,
      null,
    ];
    const v = validateCommentary(
      "Nice eye placing your X in the center",
      board,
      [5, 0],
    );
    expect(v).toEqual({ ok: false, reason: "phantom_cell" });
  });

  it("allows empty square when described as open", () => {
    const board: Board = [
      "O",
      null,
      null,
      null,
      null,
      "X",
      null,
      null,
      null,
    ];
    const v = validateCommentary(
      "The center is still wide open — interesting tension.",
      board,
      [5, 0],
    );
    expect(v).toEqual({ ok: true });
  });

  it("flags wrong_owner when your X is claimed on an O cell", () => {
    const board: Board = [
      "O",
      null,
      null,
      null,
      null,
      "X",
      null,
      null,
      null,
    ];
    const v = validateCommentary(
      "Bold — your X now owns the top-left story.",
      board,
      [5, 0],
    );
    expect(v).toEqual({ ok: false, reason: "wrong_owner" });
  });

  it("flags stale_cell when just played cites an older X square", () => {
    const board: Board = [
      "X",
      null,
      null,
      "O",
      null,
      "X",
      null,
      null,
      null,
    ];
    const v = validateCommentary(
      "You just played a sharp X at top-left.",
      board,
      [0, 4, 5],
    );
    expect(v).toEqual({ ok: false, reason: "stale_cell" });
  });
});

describe("selectPersistedCommentary", () => {
  it("returns fallback when validation fails", () => {
    const board: Board = [
      "O",
      null,
      null,
      null,
      null,
      "X",
      null,
      null,
      null,
    ];
    const moveHistory = [5, 0] as const;
    const out = selectPersistedCommentary(
      "Nice eye placing your X in the center",
      board,
      moveHistory,
    );
    expect(out.usedFallback).toBe(true);
    expect(out.text).toBe(commentaryFallbackLine(moveHistory));
  });

  it("returns empty when raw text is whitespace", () => {
    const out = selectPersistedCommentary("  \n", emptyBoard, []);
    expect(out.text).toBe("");
    expect(out.usedFallback).toBe(false);
  });
});

describe("commentaryFallbackLine", () => {
  it("names the last human move when present", () => {
    expect(commentaryFallbackLine([5, 0])).toBe(
      "Solid move at middle-right. Let's see how this unfolds.",
    );
  });

  it("uses generic copy when no human moves yet", () => {
    expect(commentaryFallbackLine([])).toBe(
      "Solid play so far. Let's see how this unfolds.",
    );
  });
});
