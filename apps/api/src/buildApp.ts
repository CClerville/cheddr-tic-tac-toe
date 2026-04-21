import { Redis } from "@upstash/redis";
import { createDb } from "@cheddr/db";

import { createApp } from "./app";
import { getEnv } from "./env";
import { initSentry } from "./lib/sentry";
import { createAuthRoutes } from "./routes/auth";
import { createGameRoutes } from "./routes/game";
import { createLeaderboardRoutes } from "./routes/leaderboard";
import { createUserRoutes } from "./routes/user";
import type { AppDeps } from "./types";

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
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required");
  }
  if (!env.JWT_SECRET) throw new Error("JWT_SECRET is required");

  cachedDeps = {
    db: createDb(env.DATABASE_URL),
    redis: new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
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
