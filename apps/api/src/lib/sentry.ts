import * as Sentry from "@sentry/node";

import { getEnv } from "../env.js";

let initialised = false;

/**
 * Idempotent Sentry init for the API. Called from `buildApp()` and from
 * the dev server entry. Safe to call multiple times.
 *
 * If `SENTRY_DSN` is not set we no-op, so contributors can run the API
 * locally without forcing a Sentry account.
 */
export function initSentry(): void {
  if (initialised) return;
  const env = getEnv();
  if (!env.SENTRY_DSN) {
    initialised = true;
    return;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });
  initialised = true;
}

export { Sentry };
