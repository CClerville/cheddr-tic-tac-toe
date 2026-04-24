import { z } from "zod";

/**
 * Stable, machine-readable error codes returned by the API.
 *
 * - Clients MUST branch on `code`, not on the human-readable `message`.
 * - Adding a new code is a non-breaking change. Renaming or removing one
 *   is a breaking change — bump the API contract version.
 *
 * Naming convention: lower_snake_case, no leading namespace. Group with
 * a prefix when scoping to a subsystem (e.g. `ai_*`, `session_*`).
 */
export const ApiErrorCodeSchema = z.enum([
  // Generic HTTP-shaped codes
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "validation_failed",
  "rate_limited",
  "internal_error",
  "service_unavailable",

  // Session / game lifecycle
  "session_not_found",
  "session_locked",
  "game_not_in_progress",
  "not_your_turn",
  "invalid_move",

  // AI subsystem
  "ai_quota_exceeded",
  "ai_unavailable",
  "ai_persist_failed",

  // Auth / identity
  "invalid_anon_token",
  "username_taken",
  "username_change_locked",
  "user_not_found",

  // Pagination
  "invalid_cursor",
]);

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

/**
 * Wire shape returned for all API errors. Servers MUST emit this shape
 * regardless of the underlying exception type.
 *
 * Backwards-compatibility note: `error` is kept as a free-form string in
 * the schema so unknown future codes don't break old clients during
 * staged rollouts. Clients should still narrow with `ApiErrorCodeSchema`
 * before switching on it.
 */
export const ApiErrorResponseSchema = z.object({
  /** Stable machine-readable code. Treat unknown values as "internal_error". */
  error: z.string(),
  /** Human-readable, possibly localized message. Safe to surface to users. */
  message: z.string(),
  /** Echo of the server-side request id (also returned in `x-request-id`). */
  requestId: z.string().optional(),
  /** Optional structured detail payload. Subsystem-specific. */
  details: z.record(z.string(), z.unknown()).optional(),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

/**
 * Typed Error subclass thrown by the API client when a request fails.
 *
 * Carrying both `code` (machine-stable) and `status` (HTTP-stable) lets
 * UI layers branch on whichever level is more meaningful — e.g. show a
 * generic "rate limited, try again" toast for any 429, but special-case
 * `ai_quota_exceeded` with a paywall prompt.
 */
export class ApiError extends Error {
  /** Stable machine-readable code, defaulting to "internal_error". */
  readonly code: ApiErrorCode;
  /** HTTP status code from the response. */
  readonly status: number;
  /** Server request id for support / Sentry correlation. */
  readonly requestId: string | null;
  /** Optional subsystem-specific detail payload. */
  readonly details?: Readonly<Record<string, unknown>> | undefined;

  constructor(args: {
    message: string;
    code: ApiErrorCode;
    status: number;
    requestId: string | null;
    details?: Readonly<Record<string, unknown>> | undefined;
  }) {
    super(args.message);
    this.name = "ApiError";
    this.code = args.code;
    this.status = args.status;
    this.requestId = args.requestId;
    if (args.details !== undefined) {
      this.details = args.details;
    }
  }

  /** True when the response can be retried (transient server / network). */
  get isRetryable(): boolean {
    return (
      this.status === 408 ||
      this.status === 425 ||
      this.status === 429 ||
      this.status >= 500
    );
  }
}

/**
 * Narrow an unknown string to a known `ApiErrorCode`, falling back to
 * `internal_error`. Use this on the wire boundary so downstream code
 * can switch exhaustively.
 */
export function coerceApiErrorCode(value: unknown): ApiErrorCode {
  const parsed = ApiErrorCodeSchema.safeParse(value);
  return parsed.success ? parsed.data : "internal_error";
}
