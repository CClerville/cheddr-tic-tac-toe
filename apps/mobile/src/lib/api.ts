import Constants from "expo-constants";
import * as Crypto from "expo-crypto";

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
 * Lazy import to break the circular dep between `api.ts` and `auth.ts`
 * (auth.ts uses apiPost; we use ensureAnonIdentity here as a fallback).
 *
 * Singleton in-flight promise so parallel requests (e.g. leaderboard's
 * two queries firing at once) coalesce into a single mint POST.
 */
let inflightMint: Promise<string | null> | null = null;
async function mintAnonInline(): Promise<string | null> {
  if (inflightMint) return inflightMint;
  inflightMint = (async () => {
    try {
      const { ensureAnonIdentity } = await import("./auth");
      const id = await ensureAnonIdentity();
      return id?.token ?? null;
    } catch {
      return null;
    } finally {
      inflightMint = null;
    }
  })();
  return inflightMint;
}

type ResolvedBearer = {
  token: string | null;
  source: "clerk" | "anon" | "none";
};

/**
 * Resolve the bearer token used for an outgoing request:
 *   - Clerk session token if signed in (preferred)
 *   - Cached anon device token
 *   - Freshly-minted anon token as a last resort (self-heals races where
 *     a request fires before AuthBootstrap finishes the initial mint)
 *
 * `skipMint` is set when we're already calling `/auth/anon` to avoid
 * infinite recursion.
 */
async function resolveBearer(skipMint: boolean): Promise<ResolvedBearer> {
  if (getClerkToken) {
    try {
      const t = await getClerkToken();
      if (t) return { token: t, source: "clerk" };
    } catch {
      // fall through to anon
    }
  }
  const cached = await getAnonToken();
  if (cached) return { token: cached, source: "anon" };
  if (skipMint) return { token: null, source: "none" };
  const minted = await mintAnonInline();
  return { token: minted, source: minted ? "anon" : "none" };
}

/**
 * `fetch` drop-in that injects `Authorization: Bearer <token>` and the
 * mobile-side request id (so server logs can be correlated).
 *
 * Self-healing on auth: if no token is available we mint an anon
 * identity inline before sending. If the server still returns 401 we
 * mint a fresh anon token (the cached one is likely expired) and retry
 * the request once. This keeps the UI usable even if AuthBootstrap's
 * initial mint races with the first query.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const url =
    typeof input === "string" && !input.startsWith("http")
      ? `${API_BASE_URL}${input.startsWith("/") ? input : `/${input}`}`
      : input;

  const isAuthAnon = typeof url === "string" && url.endsWith("/auth/anon");

  const send = async (bearer: string | null): Promise<Response> => {
    const headers = new Headers(init.headers ?? {});
    if (bearer && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${bearer}`);
    }
    if (!headers.has("Content-Type") && init.body) {
      headers.set("Content-Type", "application/json");
    }
    if (!headers.has("x-request-id")) {
      // Hermes has no global `crypto`. expo-crypto is sync and Hermes-safe.
      headers.set("x-request-id", Crypto.randomUUID());
    }
    return fetch(url, { ...init, headers });
  };

  const bearer = await resolveBearer(isAuthAnon);
  const res = await send(bearer.token);

  // One-shot retry on 401 with a fresh anon token. Skip when we ARE the
  // /auth/anon call (would loop) or when the failed request used a Clerk
  // token (the server rejection is meaningful and re-minting anon won't
  // help — the caller needs to handle re-auth).
  if (res.status === 401 && !isAuthAnon && bearer.source !== "clerk") {
    const fresh = await mintAnonInline();
    if (fresh && fresh !== bearer.token) {
      return await send(fresh);
    }
  }

  return res;
}

function resolveUrl(input: string): string {
  return input.startsWith("http")
    ? input
    : `${API_BASE_URL}${input.startsWith("/") ? input : `/${input}`}`;
}

/**
 * POST with `expo/fetch` so `response.body` is a proper byte stream on
 * native (needed for `/ai/commentary` text streaming).
 */
export async function apiPostStreaming(
  path: string,
  body: unknown,
  init?: { signal?: AbortSignal },
): Promise<Response> {
  const { fetch: expoFetch } = await import("expo/fetch");
  const url = resolveUrl(path);
  const isAuthAnon = url.endsWith("/auth/anon");

  const send = async (bearer: string | null): Promise<Response> => {
    const headers = new Headers();
    if (bearer) headers.set("Authorization", `Bearer ${bearer}`);
    headers.set("Content-Type", "application/json");
    headers.set("x-request-id", Crypto.randomUUID());
    return expoFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: init?.signal,
    });
  };

  const bearer = await resolveBearer(isAuthAnon);
  let res = await send(bearer.token);
  if (res.status === 401 && !isAuthAnon && bearer.source !== "clerk") {
    const fresh = await mintAnonInline();
    if (fresh && fresh !== bearer.token) {
      res = await send(fresh);
    }
  }
  return res;
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

export async function apiPatch<T, B = unknown>(
  path: string,
  body?: B,
): Promise<T> {
  const res = await authFetch(path, {
    method: "PATCH",
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
  let message = res.statusText?.trim()
    ? `${res.status} ${res.statusText}`
    : `HTTP ${res.status}`;
  try {
    const text = await res.text();
    if (text) {
      try {
        const body = JSON.parse(text) as { message?: string; error?: string };
        if (body.message) message = body.message;
        else if (body.error) message = body.error;
      } catch {
        // Hono's HTTPException returns the message as plain text; use it
        // verbatim as long as it isn't just the bare status line.
        const trimmed = text.trim();
        if (trimmed && trimmed !== String(res.status)) message = trimmed;
      }
    }
  } catch {
    // body unreadable
  }
  return new ApiError(message, res.status, res.headers.get("x-request-id"));
}
