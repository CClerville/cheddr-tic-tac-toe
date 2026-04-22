import type { ErrorHandler, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

import { Sentry } from "../lib/sentry.js";
import type { AppBindings } from "../types.js";

/**
 * Per-request scope: tag the Sentry scope with the request ID and the
 * authenticated user (if any) so events can be correlated end-to-end.
 */
export function sentryScope(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    Sentry.withScope((scope) => {
      scope.setTag("request_id", c.get("requestId"));
      scope.setTag("route", `${c.req.method} ${c.req.path}`);
    });
    await next();
    const identity = c.get("identity");
    if (identity) {
      Sentry.setUser({ id: identity.id, username: identity.username ?? undefined });
    }
  };
}

/**
 * Hono onError handler that forwards 5xx and unexpected errors to Sentry.
 * 4xx HTTPExceptions are intentionally *not* reported -- they're
 * client-driven and would drown the signal in noise.
 */
export const sentryErrorHandler: ErrorHandler<AppBindings> = (err, c) => {
  const status =
    err instanceof HTTPException ? err.status : ((err as { status?: number }).status ?? 500);
  if (status >= 500 || !(err instanceof HTTPException)) {
    Sentry.captureException(err, {
      tags: { request_id: c.get("requestId") ?? "unknown" },
    });
  }
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  return c.json(
    { error: "internal_error", message: "An unexpected error occurred" },
    500,
  );
};
