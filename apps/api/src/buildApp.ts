import { Redis } from "@upstash/redis";
import { createDb } from "@cheddr/db";

import { createApp } from "./app.js";
import { getEnv, getRedisRest } from "./env.js";
import { initSentry } from "./lib/sentry.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createGameRoutes } from "./routes/game.js";
import { createLeaderboardRoutes } from "./routes/leaderboard.js";
import { createUserRoutes } from "./routes/user.js";
import type { AppDeps } from "./types.js";

/**
 * Lazy-built singletons. We construct on first call so a cold Vercel
 * invocation only pays the wiring cost once and subsequent warm
 * invocations reuse the clients.
 */
let cachedDeps: AppDeps | null = null;

export function getDeps(): AppDeps {
  if (cachedDeps) return cachedDeps;
  const env = getEnv();

  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const redisRest = getRedisRest();
  if (!redisRest.url || !redisRest.token) {
    throw new Error(
      "Upstash REST credentials are required (UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN)",
    );
  }
  if (!env.JWT_SECRET) throw new Error("JWT_SECRET is required");

  cachedDeps = {
    db: createDb(env.DATABASE_URL),
    redis: new Redis({
      url: redisRest.url,
      token: redisRest.token,
    }),
    clerkSecretKey: env.CLERK_SECRET_KEY ?? null,
    jwtSecret: env.JWT_SECRET,
  };
  return cachedDeps;
}

/**
 * Production app factory: wires real dependencies and mounts all routes.
 * Integration tests bypass this entirely by calling `createApp()` directly
 * and mounting individual route factories with injected fakes.
 */
export function buildApp() {
  initSentry();
  const deps = getDeps();
  return createApp()
    .route("/auth", createAuthRoutes(deps))
    .route("/game", createGameRoutes(deps))
    .route("/user", createUserRoutes(deps))
    .route("/leaderboard", createLeaderboardRoutes(deps));
}

export function resetDepsCacheForTests(): void {
  cachedDeps = null;
}
