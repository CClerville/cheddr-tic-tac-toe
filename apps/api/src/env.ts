import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3005),

  /** Comma-separated list, or `*` for any. */
  ALLOWED_ORIGINS: z.string().default("*"),

  DATABASE_URL: z.string().url().optional(),

  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),

  /** HS256 secret used to sign anonymous device JWTs. */
  JWT_SECRET: z.string().min(32).optional(),

  SENTRY_DSN: z.string().url().optional(),
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
