import { describe, expect, it, vi } from "vitest";

// useUserStats.ts pulls in Clerk + AuthBootstrap + the API client at module
// load time. We only want to exercise its pure exports
// (`combineMode`, `totalAcrossDifficulties`, `EMPTY_*`), so we stub the
// React-Native-leaning modules to no-ops before importing the hook module.
vi.mock("@clerk/clerk-expo", () => ({
  useAuth: () => ({ isSignedIn: false, isLoaded: true, userId: null }),
}));

vi.mock("@/providers/AuthBootstrap", () => ({
  useAuthBootstrap: () => ({ ready: true }),
}));

vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false, error: null }),
}));

import {
  EMPTY_DIFFICULTY_MODE,
  EMPTY_MODE,
  EMPTY_USER_STATS,
  combineMode,
  totalAcrossDifficulties,
} from "@/hooks/useUserStats";

describe("useUserStats pure helpers", () => {
  it("EMPTY_MODE is all-zero and frozen", () => {
    expect(EMPTY_MODE).toEqual({ wins: 0, losses: 0, draws: 0, total: 0 });
    expect(Object.isFrozen(EMPTY_MODE)).toBe(true);
  });

  it("EMPTY_DIFFICULTY_MODE has zero ranked + casual buckets", () => {
    expect(EMPTY_DIFFICULTY_MODE.ranked).toEqual(EMPTY_MODE);
    expect(EMPTY_DIFFICULTY_MODE.casual).toEqual(EMPTY_MODE);
  });

  it("EMPTY_USER_STATS contains all three difficulties and empty personality list", () => {
    expect(EMPTY_USER_STATS.byDifficulty.beginner).toEqual(EMPTY_DIFFICULTY_MODE);
    expect(EMPTY_USER_STATS.byDifficulty.intermediate).toEqual(
      EMPTY_DIFFICULTY_MODE,
    );
    expect(EMPTY_USER_STATS.byDifficulty.expert).toEqual(EMPTY_DIFFICULTY_MODE);
    expect(EMPTY_USER_STATS.byPersonality).toEqual([]);
  });

  it("combineMode sums two ModeStats field-by-field", () => {
    const a = { wins: 2, losses: 1, draws: 0, total: 3 };
    const b = { wins: 5, losses: 4, draws: 2, total: 11 };
    expect(combineMode(a, b)).toEqual({
      wins: 7,
      losses: 5,
      draws: 2,
      total: 14,
    });
  });

  it("combineMode is identity-safe with EMPTY_MODE", () => {
    const x = { wins: 3, losses: 1, draws: 1, total: 5 };
    expect(combineMode(EMPTY_MODE, x)).toEqual(x);
    expect(combineMode(x, EMPTY_MODE)).toEqual(x);
  });

  it("totalAcrossDifficulties sums one mode across all three difficulties", () => {
    const byDifficulty = {
      beginner: {
        ranked: { wins: 1, losses: 0, draws: 0, total: 1 },
        casual: { wins: 2, losses: 0, draws: 0, total: 2 },
      },
      intermediate: {
        ranked: { wins: 3, losses: 1, draws: 0, total: 4 },
        casual: { wins: 1, losses: 1, draws: 0, total: 2 },
      },
      expert: {
        ranked: { wins: 0, losses: 5, draws: 1, total: 6 },
        casual: { wins: 0, losses: 2, draws: 1, total: 3 },
      },
    };

    expect(totalAcrossDifficulties(byDifficulty, "ranked")).toEqual({
      wins: 4,
      losses: 6,
      draws: 1,
      total: 11,
    });
    expect(totalAcrossDifficulties(byDifficulty, "casual")).toEqual({
      wins: 3,
      losses: 3,
      draws: 1,
      total: 7,
    });
  });

  it("totalAcrossDifficulties returns zeros when all buckets are empty", () => {
    expect(
      totalAcrossDifficulties(EMPTY_USER_STATS.byDifficulty, "ranked"),
    ).toEqual(EMPTY_MODE);
    expect(
      totalAcrossDifficulties(EMPTY_USER_STATS.byDifficulty, "casual"),
    ).toEqual(EMPTY_MODE);
  });
});
