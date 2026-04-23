import { describe, expect, it } from "vitest";

import { parseZrangeWithScores } from "../lib/leaderboard.js";

describe("parseZrangeWithScores", () => {
  it("decodes well-formed [member, score, ...] pairs", () => {
    expect(
      parseZrangeWithScores(["alice", 1500, "bob", "1200", "carol", 1100]),
    ).toEqual([
      { member: "alice", score: 1500 },
      { member: "bob", score: 1200 },
      { member: "carol", score: 1100 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(parseZrangeWithScores([])).toEqual([]);
  });

  it("rejects non-array input", () => {
    expect(() => parseZrangeWithScores(null)).toThrow(TypeError);
    expect(() => parseZrangeWithScores("nope")).toThrow(TypeError);
    expect(() => parseZrangeWithScores({ length: 2 })).toThrow(TypeError);
  });

  it("rejects odd-length arrays (corrupt WITHSCORES response)", () => {
    expect(() => parseZrangeWithScores(["alice", 1500, "bob"])).toThrow(
      /odd-length/,
    );
  });

  it("rejects non-finite scores so NaN ranks never reach clients", () => {
    expect(() => parseZrangeWithScores(["alice", "not-a-number"])).toThrow(
      /non-finite/,
    );
    expect(() => parseZrangeWithScores(["alice", Number.NaN])).toThrow(
      /non-finite/,
    );
    expect(() => parseZrangeWithScores(["alice", Number.POSITIVE_INFINITY])).toThrow(
      /non-finite/,
    );
  });

  it("rejects non-scalar members", () => {
    expect(() =>
      parseZrangeWithScores([{ id: "alice" }, 1500] as unknown[]),
    ).toThrow(/non-scalar member/);
  });
});
