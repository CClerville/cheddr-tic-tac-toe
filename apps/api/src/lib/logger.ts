/**
 * Lightweight structured logger.
 *
 * We deliberately do not pull in `pino` or `winston` here:
 * - The API runs on Cloudflare Workers / serverless runtimes where most
 *   Node logging libs either don't work or carry a non-trivial bundle hit.
 * - `console.*` already flushes through the platform's log pipeline; what
 *   we actually need is a *structured* JSON shape so logs are queryable
 *   downstream (Datadog, Vercel logs, etc).
 *
 * The shape `{ level, msg, time, ...fields }` is the de-facto pino schema
 * so existing log tooling parses it without configuration.
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
  /** Returns a child logger with `bindings` merged into every record. */
  readonly child: (bindings: LogFields) => Logger;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function envLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  // Tests should be quiet by default; production wants info+.
  return process.env.NODE_ENV === "test" ? "warn" : "info";
}

/**
 * `Error` instances do not serialize via `JSON.stringify` by default
 * (their interesting properties are non-enumerable). Flatten the parts
 * we care about so they survive structured logging.
 */
function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(value.cause != null ? { cause: serializeValue(value.cause) } : {}),
    };
  }
  return value;
}

function serializeFields(fields: LogFields | undefined): LogFields | undefined {
  if (!fields) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = serializeValue(v);
  }
  return out;
}

function emit(
  level: LogLevel,
  msg: string,
  base: LogFields,
  fields: LogFields | undefined,
  threshold: LogLevel,
): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[threshold]) return;
  const record = {
    level,
    time: new Date().toISOString(),
    msg,
    ...base,
    ...serializeFields(fields),
  };
  // Use the matching console method so log routing (eg. stderr for warn+)
  // still behaves correctly on platforms that key off it. The logger is
  // the *one* place in the codebase allowed to call console directly --
  // every other module should go through `logger.*`.
  const line = JSON.stringify(record);
  /* eslint-disable no-console */
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.info(line);
  /* eslint-enable no-console */
}

function build(base: LogFields, threshold: LogLevel): Logger {
  return {
    debug: (msg, fields) => emit("debug", msg, base, fields, threshold),
    info: (msg, fields) => emit("info", msg, base, fields, threshold),
    warn: (msg, fields) => emit("warn", msg, base, fields, threshold),
    error: (msg, fields) => emit("error", msg, base, fields, threshold),
    child: (bindings) => build({ ...base, ...bindings }, threshold),
  };
}

/**
 * The root logger for the API. Prefer `logger.child({ scope: "..." })`
 * inside individual modules so log records are pre-tagged with their
 * origin and can be filtered without grepping message strings.
 */
export const logger: Logger = build({ service: "api" }, envLevel());
