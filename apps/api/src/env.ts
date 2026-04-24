import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3005),

  /**
   * Comma-separated browser origins allowed for CORS. Empty string means
   * no cross-origin reflection (safe default for a bearer-token JSON API).
   * Mobile native clients do not use CORS.
   */
  ALLOWED_ORIGINS: z.string().default(""),

  /** Comma-separated `azp` values passed to Clerk `verifyToken` (defense in depth). */
  CLERK_AUTHORIZED_PARTIES: z.string().optional(),

  DATABASE_URL: z.string().url().optional(),

  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  /**
   * Aliases auto-provisioned by the Vercel ↔ Upstash Marketplace
   * integration. We accept either naming so the app boots without
   * extra env-var plumbing in Vercel.
   */
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),

  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),

  /** HS256 secret used to sign anonymous device JWTs. */
  JWT_SECRET: z.string().min(32).optional(),

  SENTRY_DSN: z.string().url().optional(),

  /**
   * Vercel AI Gateway API key (local dev). On Vercel, OIDC is used when unset.
   * Trimmed; empty string is treated as unset so `.env` typos do not block OIDC.
   */
  AI_GATEWAY_API_KEY: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  /** Gateway model id, e.g. `openai/gpt-4o-mini`. */
  AI_MODEL: z.string().optional(),
  /** Gateway model for streaming `/ai/commentary` only (stronger default for spatial accuracy). */
  AI_MODEL_COMMENTARY: z.string().optional(),
  /** Hard cap on total tokens per user per UTC day (all AI features). */
  AI_DAILY_TOKEN_BUDGET: z.coerce.number().int().positive().optional(),
  /** Aggregate cap across all users per UTC day (billing / abuse safety). */
  AI_GLOBAL_DAILY_TOKEN_BUDGET: z.coerce.number().int().positive().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/**
 * Read and validate process.env once. In production, missing required vars
 * are upgraded to errors at first access (so we fail fast). In development
 * we allow anything to be missing so contributors can run partial setups.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Strict accessors -- throw if a required var is missing at use site. */
export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = getEnv()[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Required environment variable ${String(key)} is not set`);
  }
  return value as NonNullable<Env[K]>;
}

/** Reset the env cache (test helper only). */
export function resetEnvCacheForTests(): void {
  cached = null;
}

/**
 * Resolve the Upstash REST URL/token from either the canonical
 * `UPSTASH_REDIS_REST_*` names or the `KV_REST_API_*` aliases that
 * the Vercel Marketplace integration provisions. Returns `null` for
 * either value if neither source provides it.
 */
export function getRedisRest(): { url: string | null; token: string | null } {
  const env = getEnv();
  return {
    url: env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL ?? null,
    token: env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN ?? null,
  };
}
