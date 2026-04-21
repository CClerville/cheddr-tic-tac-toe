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
}

const SESSION_TTL_SECONDS = 60 * 30; // 30 minutes
const KEY = (id: string) => `session:${id}`;

export async function createSession(
  redis: Redis,
  session: GameSession,
): Promise<void> {
  await redis.set(KEY(session.id), JSON.stringify(session), {
    ex: SESSION_TTL_SECONDS,
  });
}

export async function getSession(
  redis: Redis,
  id: string,
): Promise<GameSession | null> {
  const raw = await redis.get<string | GameSession>(KEY(id));
  if (raw === null || raw === undefined) return null;
  // Upstash auto-parses JSON when content-type is set, but we defensively
  // handle both shapes to remain driver-agnostic (incl. fakes in tests).
  if (typeof raw === "string") return JSON.parse(raw) as GameSession;
  return raw;
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
