import * as SecureStore from "expo-secure-store";

/**
 * Thin wrapper around `expo-secure-store` that:
 *   - Falls back to in-memory storage on web (SecureStore is native-only)
 *   - Centralises our key namespace so we never collide on storage keys
 */

export const KEYS = {
  ANON_TOKEN: "cheddr.anon.token",
  ANON_USER_ID: "cheddr.anon.userId",
  ANON_EXPIRES_AT: "cheddr.anon.expiresAt",
  DEVICE_ID: "cheddr.device.id",
  CLERK_TOKEN_CACHE_PREFIX: "cheddr.clerk.",
} as const;

const memoryStore = new Map<string, string>();

const isNative =
  typeof SecureStore.setItemAsync === "function" &&
  typeof navigator === "undefined";

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (!isNative) return memoryStore.get(key) ?? null;
    return (await SecureStore.getItemAsync(key)) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (!isNative) {
      memoryStore.set(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (!isNative) {
      memoryStore.delete(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
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
