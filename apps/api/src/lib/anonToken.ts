import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";
const ISSUER = "cheddr-api";
const AUDIENCE = "cheddr-mobile";
const TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

export interface AnonTokenPayload {
  sub: string;
  iat: number;
  exp: number;
  /** Device id from mint request, when bound. */
  did?: string;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Mint an anonymous device-bound JWT. The `subject` is the anon user ID,
 * which we generate as `anon_<uuid>` so it can never collide with a Clerk
 * user ID (which use the `user_xxx` shape).
 */
export async function mintAnonToken(
  secret: string,
  subject: string,
  ttlSeconds: number = TTL_SECONDS,
  deviceId?: string,
): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  const claims =
    deviceId !== undefined && deviceId.length > 0 ? { did: deviceId } : {};
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(subject)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key(secret));
  return { token, expiresAt: exp };
}

export async function verifyAnonToken(
  secret: string,
  token: string,
): Promise<AnonTokenPayload> {
  const { payload } = await jwtVerify(token, key(secret), {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: [ALG],
  });
  if (typeof payload.sub !== "string" || !payload.sub.startsWith("anon_")) {
    throw new Error("Invalid anon token subject");
  }
  if (typeof payload.iat !== "number" || typeof payload.exp !== "number") {
    throw new Error("Invalid anon token timestamps");
  }
  const did =
    typeof payload.did === "string" && payload.did.length > 0
      ? payload.did
      : undefined;
  return { sub: payload.sub, iat: payload.iat, exp: payload.exp, did };
}

/** Generate a fresh anon user ID. */
export function newAnonUserId(): string {
  return `anon_${crypto.randomUUID()}`;
}
