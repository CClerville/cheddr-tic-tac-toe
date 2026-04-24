import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import {
  AnonRequestSchema,
  type AnonResponse,
  type MeResponse,
} from "@cheddr/api-types";
import { schema } from "@cheddr/db";

import { mintAnonToken, newAnonUserId } from "../lib/anonToken.js";
import {
  createUpstashAnonMintLimiter,
} from "../lib/ai/rateLimit.js";
import { apiError } from "../lib/errors.js";
import { auth, ensureUser } from "../middleware/auth.js";
import type { AppBindings, AppDeps } from "../types.js";

const ANON_DEVICE_BIND_PREFIX = "cheddr:anon:device:";
const ANON_DEVICE_BIND_TTL_SECONDS = 60 * 60 * 24 * 90;

function anonDeviceBindKey(deviceId: string): string {
  return `${ANON_DEVICE_BIND_PREFIX}${deviceId}`;
}

function clientIp(c: { req: { header: (n: string) => string | undefined } }): string {
  const xf = c.req.header("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  return c.req.header("x-real-ip")?.trim() ?? "unknown";
}

function mintRateLimitedResponse(
  message: string,
  retryAfterSeconds: number,
): HTTPException {
  return apiError("rate_limited", message, {
    headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) },
  });
}

/**
 * Auth routes. Anonymous mint is unauthenticated (it's how a brand-new
 * device acquires its first identity). `/me` requires a valid token.
 */
export function createAuthRoutes(deps: AppDeps) {
  const { db, redis, clerkSecretKey, jwtSecret, anonMintLimiter } = deps;
  const mintLimiter =
    anonMintLimiter ?? createUpstashAnonMintLimiter(redis);

  const requireAuth = auth({ db, clerkSecretKey, jwtSecret });

  return new Hono<AppBindings>()
    .post(
      "/anon",
      zValidator("json", AnonRequestSchema),
      async (c) => {
        const { deviceId } = c.req.valid("json");
        const ip = clientIp(c);

        const ipRl = await mintLimiter.limitByIp(ip);
        if (!ipRl.success) {
          throw mintRateLimitedResponse(
            "Too many anon mint requests from this network",
            Math.max(1, Math.ceil((ipRl.reset - Date.now()) / 1000)),
          );
        }
        const globalRl = await mintLimiter.limitGlobal();
        if (!globalRl.success) {
          throw mintRateLimitedResponse(
            "Anon mint temporarily unavailable; try again later",
            Math.max(1, Math.ceil((globalRl.reset - Date.now()) / 1000)),
          );
        }

        const bindKey = anonDeviceBindKey(deviceId);
        let userId: string | null =
          (await redis.get<string>(bindKey)) ?? null;

        if (typeof userId === "string") {
          await ensureUser(db, userId, "anon");
        } else {
          const candidate = newAnonUserId();
          await ensureUser(db, candidate, "anon");
          const acquired = await redis.set(bindKey, candidate, {
            nx: true,
            ex: ANON_DEVICE_BIND_TTL_SECONDS,
          });
          if (acquired === null) {
            await db.delete(schema.users).where(eq(schema.users.id, candidate));
            const winner = await redis.get<string>(bindKey);
            if (!winner) {
              throw apiError(
                "service_unavailable",
                "Failed to bind device identity; retry",
              );
            }
            userId = winner;
            await ensureUser(db, userId, "anon");
          } else {
            userId = candidate;
          }
        }

        const { token, expiresAt } = await mintAnonToken(
          jwtSecret,
          userId,
          undefined,
          deviceId,
        );
        const body: AnonResponse = { token, userId, expiresAt };
        return c.json(body);
      },
    )
    .get("/me", requireAuth, (c) => {
      const identity = c.get("identity");
      const body: MeResponse = { identity };
      return c.json(body);
    });
}
