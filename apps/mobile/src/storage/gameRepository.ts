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

export interface DifficultyStats {
  wins: number;
  losses: number;
  draws: number;
}

export interface GameStats {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  byDifficulty: Record<Difficulty, DifficultyStats>;
}

export const EMPTY_STATS: GameStats = Object.freeze({
  totalGames: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  byDifficulty: Object.freeze({
    beginner: Object.freeze({ wins: 0, losses: 0, draws: 0 }),
    intermediate: Object.freeze({ wins: 0, losses: 0, draws: 0 }),
    expert: Object.freeze({ wins: 0, losses: 0, draws: 0 }),
  }),
}) as GameStats;

export type StatsListener = (stats: GameStats) => void;

export interface GameRepository {
  loadGame(): Promise<GameState | null>;
  saveGame(state: GameState): Promise<void>;
  clearGame(): Promise<void>;
  loadStats(): Promise<GameStats>;
  recordResult(outcome: GameOutcome, difficulty: Difficulty): Promise<GameStats>;
  resetStats(): Promise<void>;
  /**
   * Subscribe to local-stat changes. The callback fires after every successful
   * `recordResult` and `resetStats`. Returns an unsubscribe function.
   *
   * UI code should pair this with a one-shot `loadStats()` on mount so the
   * subscriber stays in sync even if changes occurred while it was unmounted.
   */
  subscribe(listener: StatsListener): () => void;
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

function isDifficultyStats(v: unknown): v is DifficultyStats {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.wins === "number" &&
    typeof o.losses === "number" &&
    typeof o.draws === "number"
  );
}

function isStats(v: unknown): v is GameStats {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  if (
    typeof s.totalGames !== "number" ||
    typeof s.wins !== "number" ||
    typeof s.losses !== "number" ||
    typeof s.draws !== "number"
  ) {
    return false;
  }
  const bd = s.byDifficulty as Record<string, unknown> | undefined;
  if (!bd || typeof bd !== "object") return false;
  return (
    isDifficultyStats(bd.beginner) &&
    isDifficultyStats(bd.intermediate) &&
    isDifficultyStats(bd.expert)
  );
}

function emptyStats(): GameStats {
  return {
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
}

function applyOutcome(
  stats: GameStats,
  outcome: GameOutcome,
  difficulty: Difficulty,
): GameStats {
  const winInc = outcome === "win" ? 1 : 0;
  const lossInc = outcome === "loss" ? 1 : 0;
  const drawInc = outcome === "draw" ? 1 : 0;
  const row = stats.byDifficulty[difficulty];
  return {
    totalGames: stats.totalGames + 1,
    wins: stats.wins + winInc,
    losses: stats.losses + lossInc,
    draws: stats.draws + drawInc,
    byDifficulty: {
      ...stats.byDifficulty,
      [difficulty]: {
        wins: row.wins + winInc,
        losses: row.losses + lossInc,
        draws: row.draws + drawInc,
      },
    },
  };
}

/**
 * Single-flight write queue. AsyncStorage offers no transactional read+write,
 * so any unguarded `recordResult` is racy — two terminal results landing close
 * together can read the same baseline and clobber each other. We chain every
 * mutation onto a promise so increments are strictly serialised.
 */
function createMutationQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = tail.then(task, task);
    // Don't let one failed task poison the queue for subsequent writes.
    tail = next.catch(() => undefined);
    return next;
  };
}

function createListenerSet() {
  const listeners = new Set<StatsListener>();
  return {
    add(listener: StatsListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(stats: GameStats) {
      // Snapshot to avoid mutation-during-iteration bugs if a listener
      // unsubscribes synchronously.
      for (const l of [...listeners]) {
        try {
          l(stats);
        } catch {
          // A buggy listener must not break the others.
        }
      }
    },
  };
}

export function createAsyncStorageGameRepository(): GameRepository {
  const enqueue = createMutationQueue();
  const listeners = createListenerSet();

  async function readStatsRaw(): Promise<GameStats> {
    try {
      const raw = await AsyncStorage.getItem(STATS_KEY);
      if (!raw) return emptyStats();
      const parsed = JSON.parse(raw) as unknown;
      if (!isStats(parsed)) return emptyStats();
      return parsed;
    } catch {
      return emptyStats();
    }
  }

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
    loadStats() {
      // Reads bypass the queue — they're idempotent and we want them fast,
      // but we still chain so a read issued mid-write sees the post-write
      // value (AsyncStorage is sequential per key, but the mutation queue
      // holds the canonical post-update state in-memory before flushing).
      return enqueue(readStatsRaw);
    },
    recordResult(outcome, difficulty) {
      return enqueue(async () => {
        const current = await readStatsRaw();
        const next = applyOutcome(current, outcome, difficulty);
        try {
          await AsyncStorage.setItem(STATS_KEY, JSON.stringify(next));
        } catch {
          // best-effort: even on disk failure we still emit the in-memory
          // delta so the UI reflects the user's most recent action.
        }
        listeners.emit(next);
        return next;
      });
    },
    async resetStats() {
      await enqueue(async () => {
        try {
          await AsyncStorage.removeItem(STATS_KEY);
        } catch {
          // best-effort
        }
        listeners.emit(emptyStats());
      });
    },
    subscribe(listener) {
      return listeners.add(listener);
    },
  };
}

/** In-memory implementation suitable for tests and Storybook. */
export function createInMemoryGameRepository(): GameRepository {
  const enqueue = createMutationQueue();
  const listeners = createListenerSet();
  let saved: GameState | null = null;
  let stats: GameStats = emptyStats();
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
    loadStats() {
      return enqueue(async () => stats);
    },
    recordResult(outcome, difficulty) {
      return enqueue(async () => {
        stats = applyOutcome(stats, outcome, difficulty);
        listeners.emit(stats);
        return stats;
      });
    },
    async resetStats() {
      await enqueue(async () => {
        stats = emptyStats();
        listeners.emit(stats);
      });
    },
    subscribe(listener) {
      return listeners.add(listener);
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
  // status === 'loss': loser X = player loses; loser === 'O' = AI loses = player wins
  return result.loser === "X" ? "loss" : "win";
}
