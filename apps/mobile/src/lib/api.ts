import Constants from "expo-constants";

import { KEYS, storage } from "./secureStore";

/**
 * Pull the API base URL from Expo config, falling back to localhost for
 * the simulator / development. Production builds inject the real value
 * via `EXPO_PUBLIC_API_URL`.
 */
function resolveApiBaseUrl(): string {
  const fromEnv =
    process.env.EXPO_PUBLIC_API_URL ??
    (Constants.expoConfig?.extra?.apiUrl as string | undefined);
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:3005";
}

export const API_BASE_URL = resolveApiBaseUrl();

/** Optional Clerk getToken override (set by useApiAuth in _layout). */
let getClerkToken: (() => Promise<string | null>) | null = null;

export function setClerkTokenGetter(
  getter: (() => Promise<string | null>) | null,
): void {
  getClerkToken = getter;
}

/** Read the cached anon token without minting. Used by the auth fetch. */
async function getAnonToken(): Promise<string | null> {
  return await storage.getItem(KEYS.ANON_TOKEN);
}

/**
 * Resolve the bearer token used for an outgoing request:
 *   - Clerk session token if signed in (preferred)
 *   - Anon device token otherwise
 */
async function resolveBearer(): Promise<string | null> {
  if (getClerkToken) {
    try {
      const t = await getClerkToken();
      if (t) return t;
    } catch {
      // fall through to anon
    }
  }
  return await getAnonToken();
}

/**
 * `fetch` drop-in that injects `Authorization: Bearer <token>` and the
 * mobile-side request id (so server logs can be correlated). Other
 * options pass through unchanged.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  const bearer = await resolveBearer();
  if (bearer && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${bearer}`);
  }
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("x-request-id")) {
    headers.set("x-request-id", crypto.randomUUID());
  }

  const url =
    typeof input === "string" && !input.startsWith("http")
      ? `${API_BASE_URL}${input.startsWith("/") ? input : `/${input}`}`
      : input;

  return fetch(url, { ...init, headers });
}

/**
 * Tiny convenience helpers. We deliberately avoid a heavy generated
 * client (`hc<AppType>()`) because importing the API's internal Hono
 * type from a React Native bundle is fragile and bloats the bundle.
 * Instead we keep typed request/response with Zod schemas from
 * `@cheddr/api-types` and call thin wrappers below.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await authFetch(path);
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

export async function apiPost<T, B = unknown>(
  path: string,
  body?: B,
): Promise<T> {
  const res = await authFetch(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = `${res.status} ${res.statusText}`;
  try {
    const body = (await res.json()) as { message?: string; error?: string };
    if (body.message) message = body.message;
    else if (body.error) message = body.error;
  } catch {
    // body wasn't JSON
  }
  return new ApiError(message, res.status, res.headers.get("x-request-id"));
}
