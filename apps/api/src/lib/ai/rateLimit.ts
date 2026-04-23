import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";

/** Minimal shape shared by Upstash `Ratelimit` and in-memory test doubles. */
export type AiLimitClient = {
  limit: (identifier: string) => Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
    pending: Promise<unknown>;
  }>;
};

export type AiLimiters = {
  commentary: AiLimitClient;
  hint: AiLimitClient;
  analysis: AiLimitClient;
};

export function createUpstashAiLimiters(redis: Redis): AiLimiters {
  return {
    commentary: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, "1 m"),
      prefix: "cheddr:ai:commentary",
    }),
    hint: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, "1 m"),
      prefix: "cheddr:ai:hint",
    }),
    analysis: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, "1 h"),
      prefix: "cheddr:ai:analysis",
    }),
  };
}

/**
 * In-process sliding window for tests (avoids Upstash Lua on `FakeRedis`).
 */
export function createMemoryAiLimiters(options?: {
  commentaryMax?: number;
  hintMax?: number;
  analysisMax?: number;
  windowMs?: number;
}): AiLimiters {
  const windowMs = options?.windowMs ?? 60_000;
  const pools = {
    commentary: new Map<string, number[]>(),
    hint: new Map<string, number[]>(),
    analysis: new Map<string, number[]>(),
  } as const;

  function makeLimiter(
    pool: Map<string, number[]>,
    max: number,
  ): AiLimitClient {
    return {
      async limit(identifier: string) {
        const now = Date.now();
        const arr = (pool.get(identifier) ?? []).filter((t) => t > now - windowMs);
        arr.push(now);
        pool.set(identifier, arr);
        const success = arr.length <= max;
        return {
          success,
          limit: max,
          remaining: Math.max(0, max - arr.length),
          reset: now + windowMs,
          pending: Promise.resolve(),
        };
      },
    };
  }

  return {
    commentary: makeLimiter(pools.commentary, options?.commentaryMax ?? 30),
    hint: makeLimiter(pools.hint, options?.hintMax ?? 10),
    analysis: makeLimiter(pools.analysis, options?.analysisMax ?? 5),
  };
}

export function resolveAiLimiters(redis: Redis, override?: AiLimiters): AiLimiters {
  return override ?? createUpstashAiLimiters(redis);
}

/** Rate limits for `POST /auth/anon` (IP + global abuse / cost surface). */
export type AnonMintLimiter = {
  limitByIp: (ip: string) => Promise<{ success: boolean; reset: number }>;
  limitGlobal: () => Promise<{ success: boolean; reset: number }>;
};

export function createUpstashAnonMintLimiter(redis: Redis): AnonMintLimiter {
  const byIp = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    prefix: "cheddr:auth:anon:ip",
  });
  const global = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(2000, "1 h"),
    prefix: "cheddr:auth:anon:global",
  });
  return {
    async limitByIp(ip: string) {
      const r = await byIp.limit(ip || "unknown");
      void r.pending;
      return { success: r.success, reset: r.reset };
    },
    async limitGlobal() {
      const r = await global.limit("singleton");
      void r.pending;
      return { success: r.success, reset: r.reset };
    },
  };
}

/** Permissive no-op limiter for tests. */
export function createMemoryAnonMintLimiter(): AnonMintLimiter {
  return {
    async limitByIp() {
      return { success: true, reset: Date.now() + 60_000 };
    },
    async limitGlobal() {
      return { success: true, reset: Date.now() + 60_000 };
    },
  };
}
