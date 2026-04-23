import type { Personality } from "@cheddr/api-types";
import type { Redis } from "@upstash/redis";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
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

/**
 * Commentary lines are stored separately so streaming `onFinish` cannot
 * clobber a concurrent `/game/move` read-modify-write on the live session.
 *
 * Legacy: JSON array blob at `session:commentary:${id}` (SET). New path:
 * Redis LIST at `session:commentary:list:${id}` with RPUSH + LTRIM (atomic
 * per line append, bounded to last 20).
 */
const COMMENTARY_SIDECAR_KEY = (id: string) => `session:commentary:${id}`;
const COMMENTARY_LIST_KEY = (id: string) => `session:commentary:list:${id}`;

const MOVE_LOCK_KEY = (id: string) => `session:move_lock:${id}`;
const MOVE_LOCK_TTL_SECONDS = 5;

const GameResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("in_progress") }),
  z.object({ status: z.literal("loss"), loser: z.enum(["X", "O"]) }),
  z.object({ status: z.literal("draw") }),
]);

/**
 * Validates Redis session JSON so corrupted or future-incompatible payloads
 * cannot silently propagate as `GameSession`.
 */
const GameSessionSchema = z
  .object({
    /** Optional wire version for forward-compatible evolution. */
    v: z.number().int().optional(),
    id: z.string().min(1),
    userId: z.string().min(1),
    ranked: z.boolean(),
    startedAt: z.number(),
    board: z.array(z.union([z.null(), z.enum(["X", "O"])])).length(9),
    currentPlayer: z.enum(["X", "O"]),
    moveHistory: z.array(z.number().int().min(0).max(8)),
    result: GameResultSchema,
    difficulty: z.enum(["beginner", "intermediate", "expert"]),
    personality: z.string().optional(),
    commentaryHistory: z
      .array(z.object({ role: z.literal("assistant"), text: z.string() }))
      .optional(),
  })
  .passthrough();

type CommentaryLine = { role: "assistant"; text: string };

function parseCommentaryLineJson(raw: string): CommentaryLine | null {
  try {
    const o = JSON.parse(raw) as unknown;
    if (
      o &&
      typeof o === "object" &&
      "role" in o &&
      (o as { role: string }).role === "assistant" &&
      "text" in o &&
      typeof (o as { text: unknown }).text === "string"
    ) {
      return { role: "assistant", text: (o as { text: string }).text };
    }
  } catch {
    /* invalid JSON */
  }
  return null;
}

async function readCommentaryList(
  redis: Redis,
  sessionId: string,
): Promise<CommentaryLine[] | null> {
  const listKey = COMMENTARY_LIST_KEY(sessionId);
  const items = await redis.lrange<string>(listKey, 0, -1);
  if (!items?.length) return null;
  const lines: CommentaryLine[] = [];
  for (const item of items) {
    const line = parseCommentaryLineJson(item);
    if (line) lines.push(line);
  }
  return lines.length > 0 ? lines : null;
}

async function readLegacyCommentaryBlob(
  redis: Redis,
  sessionId: string,
): Promise<CommentaryLine[] | null> {
  const raw = await redis.get<string | CommentaryLine[]>(
    COMMENTARY_SIDECAR_KEY(sessionId),
  );
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as CommentaryLine[]) : null;
    } catch {
      return null;
    }
  }
  return Array.isArray(raw) ? raw : null;
}

async function readCommentarySidecar(
  redis: Redis,
  sessionId: string,
): Promise<CommentaryLine[] | null> {
  const fromList = await readCommentaryList(redis, sessionId);
  if (fromList?.length) return fromList;
  return readLegacyCommentaryBlob(redis, sessionId);
}

function mergeCommentaryHistory(
  session: GameSession,
  sidecar: CommentaryLine[] | null,
): GameSession {
  if (sidecar && sidecar.length > 0) {
    return { ...session, commentaryHistory: sidecar.slice(-20) };
  }
  return session;
}

/**
 * Append one assistant commentary line to the Redis LIST sidecar (RPUSH +
 * LTRIM). Migrates a legacy JSON blob once if present. Never touches the
 * live session blob.
 */
export async function appendCommentaryLine(
  redis: Redis,
  sessionId: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const listKey = COMMENTARY_LIST_KEY(sessionId);
  const legacyKey = COMMENTARY_SIDECAR_KEY(sessionId);
  const existing = await redis.lrange<string>(listKey, 0, -1);
  if (!existing?.length) {
    const legacy = await readLegacyCommentaryBlob(redis, sessionId);
    if (legacy?.length) {
      for (const line of legacy) {
        await redis.rpush(listKey, JSON.stringify(line));
      }
      await redis.del(legacyKey);
    }
  }
  await redis.rpush(
    listKey,
    JSON.stringify({ role: "assistant" as const, text: trimmed }),
  );
  await redis.ltrim(listKey, -20, -1);
  await redis.expire(listKey, SESSION_TTL_SECONDS);
}

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
  const parsedJson: unknown =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        })()
      : raw;
  if (parsedJson === null) return null;
  const base = parseSessionPayload(parsedJson);
  if (!base) return null;
  const side = await readCommentarySidecar(redis, id);
  return mergeCommentaryHistory(base, side);
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

function parseSessionPayload(raw: unknown): GameSession | null {
  const parsed = GameSessionSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { v, ...rest } = parsed.data;
  void v;
  return normalizeSession(rest as unknown as GameSession);
}

export async function getSession(
  redis: Redis,
  id: string,
): Promise<GameSession | null> {
  const raw = await redis.get<string | GameSession>(KEY(id));
  if (raw === null || raw === undefined) return null;
  // Upstash auto-parses JSON when content-type is set, but we defensively
  // handle both shapes to remain driver-agnostic (incl. fakes in tests).
  const parsedJson: unknown =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        })()
      : raw;
  if (parsedJson === null) return null;
  const base = parseSessionPayload(parsedJson);
  if (!base) return null;
  const side = await readCommentarySidecar(redis, id);
  return mergeCommentaryHistory(base, side);
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
  await redis.del(KEY(id), COMMENTARY_SIDECAR_KEY(id), COMMENTARY_LIST_KEY(id));
}

/**
 * Serialize `/game/move` and `/game/resign` for a session so concurrent
 * requests cannot clobber Redis state or double-persist terminal games.
 */
export async function withSessionMoveLock<T>(
  redis: Redis,
  sessionId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const token = crypto.randomUUID();
  const lockKey = MOVE_LOCK_KEY(sessionId);
  const acquired = await redis.set(lockKey, token, {
    nx: true,
    ex: MOVE_LOCK_TTL_SECONDS,
  });
  if (acquired === null) {
    throw new HTTPException(409, { message: "Move in progress" });
  }
  try {
    return await fn();
  } finally {
    const current = await redis.get<string>(lockKey);
    if (current === token) {
      await redis.del(lockKey);
    }
  }
}
