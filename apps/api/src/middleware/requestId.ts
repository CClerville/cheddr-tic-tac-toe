import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../types.js";

/**
 * Attach a per-request ID. Honours an inbound `x-request-id` if present
 * (so we can correlate logs across mobile -> API -> Sentry). Otherwise
 * generates a fresh UUID.
 */
const REQUEST_ID_RE = /^[A-Za-z0-9._-]{8,64}$/;

export function requestId(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const incoming = c.req.header("x-request-id");
    const id =
      incoming && REQUEST_ID_RE.test(incoming) ? incoming : crypto.randomUUID();
    c.set("requestId", id);
    c.header("x-request-id", id);
    await next();
  };
}
