import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mem = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => mem.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
    clear: async () => {
      mem.clear();
    },
  },
}));

import {
  createAsyncStorageGameRepository,
  EMPTY_STATS,
} from "@/storage/gameRepository";

describe("createAsyncStorageGameRepository", () => {
  beforeEach(() => {
    mem.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("serializes concurrent recordResult calls", async () => {
    const repo = createAsyncStorageGameRepository();
    await repo.resetStats();
    await Promise.all([
      repo.recordResult("win", "beginner"),
      repo.recordResult("loss", "beginner"),
      repo.recordResult("draw", "expert"),
    ]);
    const stats = await repo.loadStats();
    expect(stats.totalGames).toBe(3);
    expect(stats.wins + stats.losses + stats.draws).toBe(3);
    expect(stats.byDifficulty.beginner.wins).toBe(1);
    expect(stats.byDifficulty.beginner.losses).toBe(1);
    expect(stats.byDifficulty.expert.draws).toBe(1);
    await repo.resetStats();
    const cleared = await repo.loadStats();
    expect(cleared.totalGames).toBe(EMPTY_STATS.totalGames);
  });
});
