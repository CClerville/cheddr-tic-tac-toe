import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import { Sentry } from "./sentry";

/**
 * Thin wrapper around `expo-secure-store` that:
 *   - Falls back to in-memory storage on web (SecureStore is native-only)
 *   - Centralises our key namespace so we never collide on storage keys
 *
 * Native detection: we MUST use `Platform.OS` here. A previous version
 * used `typeof navigator === "undefined"` which is unreliable on modern
 * React Native runtimes (Hermes / RN 0.81+) where `navigator` is
 * polyfilled — that bug silently routed every Clerk + anon token write
 * to the in-memory `Map`, so users were "logged out" on every cold
 * start. Tests for this live in `secureStore.native.test.ts`.
 */

export const KEYS = {
  ANON_TOKEN: "cheddr.anon.token",
  ANON_USER_ID: "cheddr.anon.userId",
  ANON_EXPIRES_AT: "cheddr.anon.expiresAt",
  DEVICE_ID: "cheddr.device.id",
  CLERK_TOKEN_CACHE_PREFIX: "cheddr.clerk.",
} as const;

const memoryStore = new Map<string, string>();

const isNative = Platform.OS !== "web";

/**
 * Some devices (rooted Android, lockscreen disabled, corp profiles) reject
 * keychain writes. We surface the failure to Sentry once per key so we can
 * triage without breaking the user — the in-memory fallback keeps the app
 * usable for the current session.
 */
const reportedKeys = new Set<string>();
function reportSecureStoreFailure(
  op: "get" | "set" | "delete",
  key: string,
  err: unknown,
): void {
  const tag = `${op}:${key}`;
  if (reportedKeys.has(tag)) return;
  reportedKeys.add(tag);
  try {
    Sentry.captureException(err, {
      tags: { area: "secureStore", op, key },
    });
  } catch {
    // Sentry not initialised yet — swallow.
  }
}

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (!isNative) return memoryStore.get(key) ?? null;
    try {
      return (await SecureStore.getItemAsync(key)) ?? null;
    } catch (err) {
      reportSecureStoreFailure("get", key, err);
      return memoryStore.get(key) ?? null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (!isNative) {
      memoryStore.set(key, value);
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      reportSecureStoreFailure("set", key, err);
      memoryStore.set(key, value);
    }
  },
  async deleteItem(key: string): Promise<void> {
    if (!isNative) {
      memoryStore.delete(key);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      reportSecureStoreFailure("delete", key, err);
    } finally {
      memoryStore.delete(key);
    }
  },
};

/** Token cache adapter accepted by ClerkProvider's `tokenCache` prop. */
export const clerkTokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      return await storage.getItem(KEYS.CLERK_TOKEN_CACHE_PREFIX + key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, token: string): Promise<void> {
    try {
      await storage.setItem(KEYS.CLERK_TOKEN_CACHE_PREFIX + key, token);
    } catch {
      // best-effort
    }
  },
  async clearToken(key: string): Promise<void> {
    try {
      await storage.deleteItem(KEYS.CLERK_TOKEN_CACHE_PREFIX + key);
    } catch {
      // best-effort
    }
  },
};
