import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Difficulty, GameState } from "@cheddr/game-engine";

const SAVED_GAME_KEY = "cheddr.game.saved.v1";
const STATS_KEY = "cheddr.game.stats.v1";
const SCHEMA_VERSION = 1;

export interface SavedGameEnvelope {
  v: number;
  state: GameState;
  savedAt: number;
}

export type GameOutcome = "win" | "loss" | "draw";

export interface GameStats {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  byDifficulty: Record<Difficulty, { wins: number; losses: number; draws: number }>;
}

export const EMPTY_STATS: GameStats = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  byDifficulty: {
    beginner: { wins: 0, losses: 0, draws: 0 },
    intermediate: { wins: 0, losses: 0, draws: 0 },
    expert: { wins: 0, losses: 0, draws: 0 },
  },
};

export interface GameRepository {
  loadGame(): Promise<GameState | null>;
  saveGame(state: GameState): Promise<void>;
  clearGame(): Promise<void>;
  loadStats(): Promise<GameStats>;
  recordResult(outcome: GameOutcome, difficulty: Difficulty): Promise<GameStats>;
  resetStats(): Promise<void>;
}

function isSavedEnvelope(v: unknown): v is SavedGameEnvelope {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return (
    obj.v === SCHEMA_VERSION &&
    typeof obj.savedAt === "number" &&
    !!obj.state &&
    typeof obj.state === "object"
  );
}

function isStats(v: unknown): v is GameStats {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.totalGames === "number" &&
    typeof s.wins === "number" &&
    typeof s.losses === "number" &&
    typeof s.draws === "number" &&
    !!s.byDifficulty
  );
}

export function createAsyncStorageGameRepository(): GameRepository {
  return {
    async loadGame() {
      try {
        const raw = await AsyncStorage.getItem(SAVED_GAME_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        if (!isSavedEnvelope(parsed)) return null;
        return parsed.state;
      } catch {
        return null;
      }
    },
    async saveGame(state) {
      const envelope: SavedGameEnvelope = {
        v: SCHEMA_VERSION,
        state,
        savedAt: Date.now(),
      };
      try {
        await AsyncStorage.setItem(SAVED_GAME_KEY, JSON.stringify(envelope));
      } catch {
        // best-effort; swallow
      }
    },
    async clearGame() {
      try {
        await AsyncStorage.removeItem(SAVED_GAME_KEY);
      } catch {
        // best-effort
      }
    },
    async loadStats() {
      try {
        const raw = await AsyncStorage.getItem(STATS_KEY);
        if (!raw) return EMPTY_STATS;
        const parsed = JSON.parse(raw) as unknown;
        if (!isStats(parsed)) return EMPTY_STATS;
        return parsed;
      } catch {
        return EMPTY_STATS;
      }
    },
    async recordResult(outcome, difficulty) {
      const current = await this.loadStats();
      const next: GameStats = {
        totalGames: current.totalGames + 1,
        wins: current.wins + (outcome === "win" ? 1 : 0),
        losses: current.losses + (outcome === "loss" ? 1 : 0),
        draws: current.draws + (outcome === "draw" ? 1 : 0),
        byDifficulty: {
          ...current.byDifficulty,
          [difficulty]: {
            wins:
              current.byDifficulty[difficulty].wins +
              (outcome === "win" ? 1 : 0),
            losses:
              current.byDifficulty[difficulty].losses +
              (outcome === "loss" ? 1 : 0),
            draws:
              current.byDifficulty[difficulty].draws +
              (outcome === "draw" ? 1 : 0),
          },
        },
      };
      try {
        await AsyncStorage.setItem(STATS_KEY, JSON.stringify(next));
      } catch {
        // best-effort
      }
      return next;
    },
    async resetStats() {
      try {
        await AsyncStorage.removeItem(STATS_KEY);
      } catch {
        // best-effort
      }
    },
  };
}

/** In-memory implementation suitable for tests and Storybook. */
export function createInMemoryGameRepository(): GameRepository {
  let saved: GameState | null = null;
  let stats: GameStats = EMPTY_STATS;
  return {
    async loadGame() {
      return saved;
    },
    async saveGame(state) {
      saved = state;
    },
    async clearGame() {
      saved = null;
    },
    async loadStats() {
      return stats;
    },
    async recordResult(outcome, difficulty) {
      stats = {
        totalGames: stats.totalGames + 1,
        wins: stats.wins + (outcome === "win" ? 1 : 0),
        losses: stats.losses + (outcome === "loss" ? 1 : 0),
        draws: stats.draws + (outcome === "draw" ? 1 : 0),
        byDifficulty: {
          ...stats.byDifficulty,
          [difficulty]: {
            wins:
              stats.byDifficulty[difficulty].wins +
              (outcome === "win" ? 1 : 0),
            losses:
              stats.byDifficulty[difficulty].losses +
              (outcome === "loss" ? 1 : 0),
            draws:
              stats.byDifficulty[difficulty].draws +
              (outcome === "draw" ? 1 : 0),
          },
        },
      };
      return stats;
    },
    async resetStats() {
      stats = EMPTY_STATS;
    },
  };
}

export const gameRepository: GameRepository = createAsyncStorageGameRepository();

/** Maps a misere `GameResult` into a player-centric outcome. */
export function outcomeFromResult(
  result: GameState["result"],
): GameOutcome | null {
  if (result.status === "in_progress") return null;
  if (result.status === "draw") return "draw";
  // status === 'loss': loser X = player loses; loser O = AI loses = player wins
  return result.loser === "X" ? "loss" : "win";
}
