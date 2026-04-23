import type { Personality } from "@cheddr/api-types";
import type { Redis } from "@upstash/redis";
import type {
  Board,
  Difficulty,
  GameResult,
  Player,
  Position,
} from "@cheddr/game-engine";

/**
 * Server-side game session as persisted to Redis. Includes the engine
 * `GameState` plus the auth-bound owner and timing metadata so we can
 * reject cross-user access and compute durations on terminal state.
 */
export interface GameSession {
  id: string;
  userId: string;
  ranked: boolean;
  startedAt: number;
  board: Board;
  currentPlayer: Player;
  moveHistory: Position[];
  result: GameResult;
  difficulty: Difficulty;
  /** Defaults to `coach` when missing (older Redis payloads). */
  personality?: Personality;
  /** Optional transcript of streamed commentary lines (server-only). */
  commentaryHistory?: { role: "assistant"; text: string }[];
}

const SESSION_TTL_SECONDS = 60 * 30; // 30 minutes
const KEY = (id: string) => `session:${id}`;
/** Short-lived copy after terminal games so `/ai/commentary` can run post-move. */
const AI_COMPLETED_KEY = (id: string) => `session:ai:${id}`;
const AI_COMPLETED_TTL_SECONDS = 60 * 10; // 10 minutes

export async function saveCompletedSessionForAi(
  redis: Redis,
  session: GameSession,
): Promise<void> {
  await redis.set(AI_COMPLETED_KEY(session.id), JSON.stringify(session), {
    ex: AI_COMPLETED_TTL_SECONDS,
  });
}

async function getCompletedSessionForAi(
  redis: Redis,
  id: string,
): Promise<GameSession | null> {
  const raw = await redis.get<string | GameSession>(AI_COMPLETED_KEY(id));
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    return normalizeSession(JSON.parse(raw) as GameSession);
  }
  return normalizeSession(raw);
}

/**
 * Active session first, then the post-terminal AI snapshot (same id).
 */
export async function loadSessionOrSnapshotForAi(
  redis: Redis,
  id: string,
): Promise<GameSession | null> {
  const live = await getSession(redis, id);
  if (live) return live;
  return await getCompletedSessionForAi(redis, id);
}

export async function createSession(
  redis: Redis,
  session: GameSession,
): Promise<void> {
  await redis.set(KEY(session.id), JSON.stringify(session), {
    ex: SESSION_TTL_SECONDS,
  });
}

function normalizeSession(s: GameSession): GameSession {
  return { ...s, personality: s.personality ?? "coach" };
}

export async function getSession(
  redis: Redis,
  id: string,
): Promise<GameSession | null> {
  const raw = await redis.get<string | GameSession>(KEY(id));
  if (raw === null || raw === undefined) return null;
  // Upstash auto-parses JSON when content-type is set, but we defensively
  // handle both shapes to remain driver-agnostic (incl. fakes in tests).
  if (typeof raw === "string") {
    return normalizeSession(JSON.parse(raw) as GameSession);
  }
  return normalizeSession(raw);
}

export async function updateSession(
  redis: Redis,
  session: GameSession,
): Promise<void> {
  // Reset TTL on every write so an active game doesn't expire mid-play.
  await redis.set(KEY(session.id), JSON.stringify(session), {
    ex: SESSION_TTL_SECONDS,
  });
}

export async function deleteSession(redis: Redis, id: string): Promise<void> {
  await redis.del(KEY(id));
}
