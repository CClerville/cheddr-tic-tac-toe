import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { getEnv } from "./env.js";
import { requestId } from "./middleware/requestId.js";
import { sentryErrorHandler, sentryScope } from "./middleware/sentry.js";
import type { AppBindings } from "./types.js";

/**
 * Build the Hono app. Routes and dependencies are registered by the caller
 * via `app.route(...)` so tests can inject in-memory fakes (Postgres, Redis,
 * Clerk verifier) without booting the production wiring.
 */
export function createApp() {
  const env = getEnv();

  const allowedOrigins =
    env.ALLOWED_ORIGINS === "*"
      ? "*"
      : env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());

  const app = new Hono<AppBindings>()
    .use("*", requestId())
    .use("*", sentryScope())
    .use(
      "*",
      cors({
        origin: allowedOrigins,
        allowHeaders: ["Authorization", "Content-Type"],
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        maxAge: 600,
      }),
    )
    .use("*", logger())
    .get("/health", (c) =>
      c.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        requestId: c.get("requestId"),
      }),
    );

  app.onError(sentryErrorHandler);

  return app;
}

/** Type used by `hc<AppType>()` consumers in the mobile app. */
export type AppType = ReturnType<typeof createApp>;
