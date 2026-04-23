import { Buffer } from "node:buffer";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { schema, type Database } from "@cheddr/db";

import {
  createMemoryAiLimiters,
  createMemoryAnonMintLimiter,
} from "../lib/ai/rateLimit.js";
import type { AppDeps } from "../types.js";
import { mintAnonToken } from "../lib/anonToken.js";
import { ensureUser } from "../middleware/auth.js";
import { createFakeRedis, type FakeRedis } from "./fakeRedis.js";

/** Create a fresh PGlite-backed Drizzle DB with the project schema applied. */
export async function createTestDb(): Promise<Database> {
  const client = new PGlite();
  const db = drizzlePglite(client, { schema }) as unknown as Database;
  await applySchema(client);
  return db;
}

async function applySchema(client: PGlite): Promise<void> {
  await client.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      kind text NOT NULL,
      username text UNIQUE,
      display_name text,
      avatar_color text,
      elo integer NOT NULL DEFAULT 1000,
      games_played integer NOT NULL DEFAULT 0,
      wins integer NOT NULL DEFAULT 0,
      losses integer NOT NULL DEFAULT 0,
      draws integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS games (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      difficulty text NOT NULL,
      result text NOT NULL,
      move_history jsonb NOT NULL,
      duration_ms integer,
      elo_delta integer NOT NULL DEFAULT 0,
      ranked boolean NOT NULL DEFAULT true,
      ai_analysis jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS games_user_created_idx
      ON games (user_id, created_at DESC);
  `);
}

export interface TestHarness {
  deps: AppDeps;
  redis: FakeRedis;
  db: Database;
  /** Mint an anon token tied to a fresh anon user (which is created in the DB). */
  signInAnon(): Promise<{ token: string; userId: string }>;
  /**
   * RS256-shaped JWT for Clerk auth tests. Pair with `vi.mock` on
   * `verifyClerkSessionToken` and `createHarness({ clerkSecretKey: "…" })`.
   */
  signInClerk(userId?: string): Promise<{ token: string; userId: string }>;
}

/** JWT with RS256 + kid so `auth` attempts Clerk verification. */
export function fakeClerkSessionJwt(sub: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", kid: "ins_testkeyid123456789" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub })).toString("base64url");
  return `${header}.${payload}.invalid-signature`;
}

export type CreateHarnessOptions = {
  /** When set, auth middleware will attempt Clerk for RS256 session tokens. */
  clerkSecretKey?: string | null;
};

export async function createHarness(options?: CreateHarnessOptions): Promise<TestHarness> {
  const db = await createTestDb();
  const redis = createFakeRedis();
  const jwtSecret = "test-jwt-secret-please-do-not-use-in-prod-32+";
  const deps: AppDeps = {
    db,
    redis: redis as unknown as AppDeps["redis"],
    clerkSecretKey: options?.clerkSecretKey !== undefined ? options.clerkSecretKey : null,
    jwtSecret,
    aiLimiters: createMemoryAiLimiters(),
    anonMintLimiter: createMemoryAnonMintLimiter(),
  };

  return {
    deps,
    redis,
    db,
    async signInAnon() {
      const userId = `anon_${crypto.randomUUID()}`;
      await ensureUser(db, userId, "anon");
      const { token } = await mintAnonToken(jwtSecret, userId);
      return { token, userId };
    },
    async signInClerk(userId = `user_clerk_${crypto.randomUUID()}`) {
      await ensureUser(db, userId, "clerk");
      return { token: fakeClerkSessionJwt(userId), userId };
    },
  };
}
