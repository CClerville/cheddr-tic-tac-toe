import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { Identity } from "@cheddr/api-types";
import type { Database } from "@cheddr/db";
import type { Redis } from "@upstash/redis";

import type { AiLimiters, AnonMintLimiter } from "./lib/ai/rateLimit.js";

/**
 * Hono context bindings. `Variables` are values set by middleware (e.g.
 * `requestId`, `auth`); `c.get('identity')` etc. are typed against this.
 */
export interface AppBindings {
  Variables: {
    requestId: string;
    identity: Identity;
  };
}

/**
 * Application-level dependencies. We pass these via factory functions to
 * routes so integration tests can inject in-memory fakes.
 *
 * `clerkSecretKey` is the only Clerk dep we need at the API surface --
 * `verifyToken` (from @clerk/backend) takes it directly. We avoid keeping
 * a `ClerkClient` instance unless we genuinely need its REST API surface.
 */
export interface AppDeps {
  db: Database;
  redis: Redis;
  clerkSecretKey: string | null;
  jwtSecret: string;
  /**
   * Optional in-memory rate limiters (tests). When omitted, Upstash
   * `Ratelimit` is constructed from `redis`.
   */
  aiLimiters?: AiLimiters;
  /**
   * Optional anon mint rate limiters (tests). When omitted, Upstash
   * `Ratelimit` is built from `redis`.
   */
  anonMintLimiter?: AnonMintLimiter;
  /**
   * Override the default Gateway language model (tests).
   */
  languageModelOverride?: () => LanguageModelV3;
}
