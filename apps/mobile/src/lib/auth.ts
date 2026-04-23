import {
  AnonResponseSchema,
  MeResponseSchema,
  type AnonRequest,
  type MeResponse,
} from "@cheddr/api-types";
import * as Crypto from "expo-crypto";

import { apiGet, apiPost } from "./api";
import { KEYS, storage } from "./secureStore";

/**
 * Bootstrap the device with an anonymous identity if it doesn't have one
 * yet. Idempotent: subsequent calls return the cached token unless it has
 * expired (or is close to expiring), in which case a fresh one is minted.
 *
 * Refresh threshold: we mint a new token when fewer than 7 days remain
 * to avoid surprising the user with a 401 mid-session.
 */
const REFRESH_THRESHOLD_SECONDS = 60 * 60 * 24 * 7;

export interface AnonIdentity {
  token: string;
  userId: string;
  expiresAt: number;
}

export async function ensureAnonIdentity(): Promise<AnonIdentity> {
  const existing = await readCachedAnon();
  const now = Math.floor(Date.now() / 1000);
  if (existing && existing.expiresAt - now > REFRESH_THRESHOLD_SECONDS) {
    return existing;
  }

  const deviceId = await ensureDeviceId();
  const body: AnonRequest = { deviceId };
  const minted = await apiPost("/auth/anon", body, AnonResponseSchema);
  await persistAnon(minted);
  return minted;
}

export async function readCachedAnon(): Promise<AnonIdentity | null> {
  const [token, userId, expiresAtRaw] = await Promise.all([
    storage.getItem(KEYS.ANON_TOKEN),
    storage.getItem(KEYS.ANON_USER_ID),
    storage.getItem(KEYS.ANON_EXPIRES_AT),
  ]);
  if (!token || !userId || !expiresAtRaw) return null;
  return { token, userId, expiresAt: Number(expiresAtRaw) };
}

async function persistAnon(identity: AnonIdentity): Promise<void> {
  await Promise.all([
    storage.setItem(KEYS.ANON_TOKEN, identity.token),
    storage.setItem(KEYS.ANON_USER_ID, identity.userId),
    storage.setItem(KEYS.ANON_EXPIRES_AT, String(identity.expiresAt)),
  ]);
}

export async function clearAnon(): Promise<void> {
  await Promise.all([
    storage.deleteItem(KEYS.ANON_TOKEN),
    storage.deleteItem(KEYS.ANON_USER_ID),
    storage.deleteItem(KEYS.ANON_EXPIRES_AT),
  ]);
}

async function ensureDeviceId(): Promise<string> {
  const existing = await storage.getItem(KEYS.DEVICE_ID);
  if (existing) return existing;
  // Hermes lacks `globalThis.crypto`; expo-crypto provides a sync UUID.
  const id = Crypto.randomUUID();
  await storage.setItem(KEYS.DEVICE_ID, id);
  return id;
}

/** Verify the cached identity is still accepted by the server. */
export async function fetchMe(): Promise<MeResponse> {
  return await apiGet("/auth/me", MeResponseSchema);
}
