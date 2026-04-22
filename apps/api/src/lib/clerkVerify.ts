import { verifyToken } from "@clerk/backend";

/**
 * Thin wrapper so auth middleware can be tested without spying on
 * `@clerk/backend` (ESM namespace exports are not spyable in Vitest).
 */
export function verifyClerkSessionToken(
  token: string,
  secretKey: string,
): ReturnType<typeof verifyToken> {
  return verifyToken(token, { secretKey });
}
