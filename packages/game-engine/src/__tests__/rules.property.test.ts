import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createGame } from "../board";
import { checkResult, getValidMoves, makeMove } from "../rules";

describe("rules property tests", () => {
  it("random legal play keeps checkResult consistent with state.result", () => {
    fc.assert(
      fc.property(fc.nat(), (seed) => {
        let state = createGame("beginner");
        let rng = seed >>> 0;
        const next = () => {
          rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
          return rng;
        };

        while (state.result.status === "in_progress") {
          const moves = getValidMoves(state.board);
          if (moves.length === 0) {
            expect(state.result).toEqual({ status: "in_progress" });
            return;
          }
          const pick = moves[next() % moves.length]!;
          state = makeMove(state, pick);
        }

        expect(checkResult(state.board)).toEqual(state.result);
      }),
      { numRuns: 100 },
    );
  });

  it("getValidMoves only lists empty cells", () => {
    fc.assert(
      fc.property(fc.nat(), (seed) => {
        let state = createGame("beginner");
        let rng = seed >>> 0;
        const next = () => {
          rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
          return rng;
        };

        for (let i = 0; i < 5 && state.result.status === "in_progress"; i++) {
          const moves = getValidMoves(state.board);
          for (const p of moves) {
            expect(state.board[p]).toBeNull();
          }
          if (moves.length === 0) break;
          state = makeMove(state, moves[next() % moves.length]!);
        }
      }),
      { numRuns: 100 },
    );
  });
});
