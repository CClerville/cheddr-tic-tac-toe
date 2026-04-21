import { describe, expect, it } from "vitest";
import {
  AI_RATINGS,
  ELO_K_FACTOR,
  MIN_ELO,
  clampDeltaToBudget,
  computeElo,
} from "../elo";

describe("computeElo", () => {
  it("rewards a small positive delta when a 1000-rated player draws an expert", () => {
    const before = 1000;
    const { playerElo, delta } = computeElo(before, "expert", "draw");
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(ELO_K_FACTOR / 2);
    expect(playerElo).toBe(before + delta);
  });

  it("awards a large positive delta when a 1000-rated player beats an expert", () => {
    const { delta } = computeElo(1000, "expert", "win");
    expect(delta).toBeGreaterThan(20);
    expect(delta).toBeLessThanOrEqual(ELO_K_FACTOR);
  });

  it("applies a large negative delta when a 1000-rated player loses to a beginner", () => {
    const { delta } = computeElo(1000, "beginner", "loss");
    expect(delta).toBeLessThan(-15);
    expect(delta).toBeGreaterThanOrEqual(-ELO_K_FACTOR);
  });

  it("awards a small delta when a 1000-rated player beats a beginner", () => {
    const { delta } = computeElo(1000, "beginner", "win");
    expect(delta).toBeGreaterThanOrEqual(0);
    expect(delta).toBeLessThan(12);
  });

  it("never drops the player's ELO below the floor", () => {
    const { playerElo } = computeElo(MIN_ELO, "expert", "loss");
    expect(playerElo).toBeGreaterThanOrEqual(MIN_ELO);
  });

  it("returns the actual applied delta (post-floor) so callers can persist it", () => {
    const before = MIN_ELO + 1;
    const { playerElo, delta } = computeElo(before, "expert", "loss");
    expect(playerElo).toBe(before + delta);
    expect(playerElo).toBeGreaterThanOrEqual(MIN_ELO);
  });

  it("uses the configured AI ratings", () => {
    expect(AI_RATINGS.beginner).toBeLessThan(AI_RATINGS.intermediate);
    expect(AI_RATINGS.intermediate).toBeLessThan(AI_RATINGS.expert);
  });

  it("is symmetric: a draw is half a win", () => {
    const win = computeElo(1000, "intermediate", "win").delta;
    const draw = computeElo(1000, "intermediate", "draw").delta;
    const loss = computeElo(1000, "intermediate", "loss").delta;
    expect(Math.abs(win + loss - 2 * draw)).toBeLessThanOrEqual(1);
  });
});

describe("clampDeltaToBudget", () => {
  it("returns the delta unchanged when within budget", () => {
    expect(clampDeltaToBudget(20, 50)).toBe(20);
  });

  it("clamps positive deltas to the remaining budget", () => {
    expect(clampDeltaToBudget(40, 30)).toBe(30);
  });

  it("returns zero when budget is exhausted", () => {
    expect(clampDeltaToBudget(40, 0)).toBe(0);
    expect(clampDeltaToBudget(40, -5)).toBe(0);
  });

  it("never clamps negative deltas (losses always count)", () => {
    expect(clampDeltaToBudget(-25, 0)).toBe(-25);
    expect(clampDeltaToBudget(-25, 100)).toBe(-25);
  });
});
