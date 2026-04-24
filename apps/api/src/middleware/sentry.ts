import type { ErrorHandler, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

import { renderInternalError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { Sentry } from "../lib/sentry.js";
import type { AppBindings } from "../types.js";

const log = logger.child({ scope: "http" });

/**
 * Per-request scope: tag the Sentry scope with the request ID and the
 * authenticated user (if any) so events can be correlated end-to-end.
 */
export function sentryScope(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    await Sentry.withScope(async (scope) => {
      scope.setTag("request_id", c.get("requestId"));
      scope.setTag("route", `${c.req.method} ${c.req.path}`);
      await next();
      const identity = c.get("identity");
      if (identity) {
        scope.setUser({
          id: identity.id,
          ...(identity.username != null && { username: identity.username }),
        });
      }
    });
  };
}

/**
 * Hono onError handler that forwards 5xx and unexpected errors to Sentry.
 * 4xx HTTPExceptions are intentionally *not* reported -- they're
 * client-driven and would drown the signal in noise.
 */
export const sentryErrorHandler: ErrorHandler<AppBindings> = (err, c) => {
  const errStatus =
    err instanceof HTTPException ? err.status : ((err as { status?: number }).status ?? 500);
  if (errStatus >= 500 || !(err instanceof HTTPException)) {
    Sentry.captureException(err, {
      tags: { request_id: c.get("requestId") ?? "unknown" },
    });
    // Surface the full stack in non-production logs so unexpected 500s
    // are debuggable without round-tripping through Sentry. Production
    // still relies on Sentry to avoid noisy stdout in serverless logs.
    if (process.env.NODE_ENV !== "production") {
      log.error("unhandled_error", {
        method: c.req.method,
        path: c.req.path,
        requestId: c.get("requestId") ?? "unknown",
        err,
      });
    }
  }
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  const rendered = renderInternalError({ requestId: c.get("requestId") });
  return c.json(rendered.body, rendered.status as Parameters<typeof c.json>[1]);
};
