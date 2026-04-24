import {
  type ApiErrorCode,
  type ApiErrorResponse,
} from "@cheddr/api-types";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HTTPException } from "hono/http-exception";

/**
 * Default HTTP status for each `ApiErrorCode`. Routes can override the
 * status when a more specific one applies (e.g. returning 402 for an
 * `ai_quota_exceeded` paywall vs the default 429-ish framing).
 */
export const STATUS_FOR_CODE: Readonly<Record<ApiErrorCode, number>> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation_failed: 422,
  rate_limited: 429,
  internal_error: 500,
  service_unavailable: 503,

  session_not_found: 404,
  session_locked: 409,
  game_not_in_progress: 409,
  not_your_turn: 409,
  invalid_move: 400,

  ai_quota_exceeded: 402,
  ai_unavailable: 503,
  ai_persist_failed: 500,
  terminal_not_ready: 425,

  invalid_anon_token: 400,
  username_taken: 409,
  username_change_locked: 403,
  user_not_found: 404,

  invalid_cursor: 400,
};

interface ApiErrorOptions {
  /** Override the default HTTP status for this code. */
  status?: number;
  /** Echo back to the client for support / log correlation. */
  requestId?: string | undefined;
  /** Subsystem-specific structured payload. */
  details?: Readonly<Record<string, unknown>>;
  /** Extra HTTP headers (e.g. `Retry-After` on rate limits). */
  headers?: Record<string, string>;
}

/**
 * Build an `HTTPException` whose JSON body is the canonical
 * `ApiErrorResponse` shape. Always prefer this over `new HTTPException`
 * directly so the wire contract stays consistent.
 *
 * Hono's default exception serializer would otherwise emit `{ message }`
 * (4xx) or `{ error }` (500) — that inconsistency is exactly what the
 * shared error contract is here to remove.
 */
export function apiError(
  code: ApiErrorCode,
  message: string,
  opts: ApiErrorOptions = {},
): HTTPException {
  const status = (opts.status ??
    STATUS_FOR_CODE[code]) as ContentfulStatusCode;
  const body: ApiErrorResponse = {
    error: code,
    message,
    ...(opts.requestId !== undefined && { requestId: opts.requestId }),
    ...(opts.details !== undefined && { details: opts.details }),
  };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...opts.headers,
  };
  return new HTTPException(status, {
    res: new Response(JSON.stringify(body), { status, headers }),
    message,
  });
}

/**
 * Render a plain (non-HTTPException) error as the canonical wire shape.
 * Used by the global onError handler for unexpected throws.
 */
export function renderInternalError(args: {
  requestId?: string | undefined;
}): { body: ApiErrorResponse; status: number } {
  return {
    status: 500,
    body: {
      error: "internal_error",
      message: "An unexpected error occurred",
      ...(args.requestId !== undefined && { requestId: args.requestId }),
    },
  };
}
