import { Sentry } from "./sentry";

/**
 * Mobile-side structured logger.
 *
 * The mobile app has different logging needs than the API:
 * - In `__DEV__` we want pretty output in Metro / Reactotron, so we
 *   defer to the matching `console.*` method (which RN already wires
 *   into the dev tools).
 * - In production builds we suppress info/debug entirely (they would
 *   only ship to the user's device console) but route warn+ through
 *   Sentry breadcrumbs so they're attached to any subsequent crash.
 *
 * The shape mirrors the API logger so call sites can be moved between
 * apps without churn: `log.warn("event_name", { ...fields })`.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  readonly [key: string]: unknown;
}

export interface Logger {
  readonly debug: (msg: string, fields?: LogFields) => void;
  readonly info: (msg: string, fields?: LogFields) => void;
  readonly warn: (msg: string, fields?: LogFields) => void;
  readonly error: (msg: string, fields?: LogFields) => void;
  readonly child: (bindings: LogFields) => Logger;
}

const SEVERITY: Record<LogLevel, "debug" | "info" | "warning" | "error"> = {
  debug: "debug",
  info: "info",
  warn: "warning",
  error: "error",
};

function emit(
  level: LogLevel,
  msg: string,
  base: LogFields,
  fields: LogFields | undefined,
): void {
  const data = { ...base, ...(fields ?? {}) };

  if (__DEV__) {
    /* eslint-disable no-console */
    if (level === "error") console.error(`[${level}] ${msg}`, data);
    else if (level === "warn") console.warn(`[${level}] ${msg}`, data);
    else if (level === "debug") console.debug(`[${level}] ${msg}`, data);
    else console.info(`[${level}] ${msg}`, data);
    /* eslint-enable no-console */
  }

  // Always file as a Sentry breadcrumb so warn/error correlate with
  // crashes even when the user can't share their console.
  if (level !== "debug") {
    try {
      Sentry.addBreadcrumb({
        category: "log",
        level: SEVERITY[level],
        message: msg,
        data,
      });
    } catch {
      // Sentry not initialized yet (eg. early bootstrap) -- swallow.
    }
  }
}

function build(base: LogFields): Logger {
  return {
    debug: (msg, fields) => emit("debug", msg, base, fields),
    info: (msg, fields) => emit("info", msg, base, fields),
    warn: (msg, fields) => emit("warn", msg, base, fields),
    error: (msg, fields) => emit("error", msg, base, fields),
    child: (bindings) => build({ ...base, ...bindings }),
  };
}

export const logger: Logger = build({ app: "mobile" });
