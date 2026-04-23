import { verifyToken } from "@clerk/backend";

import { getEnv } from "../env.js";

/**
 * Thin wrapper so auth middleware can be tested without spying on
 * `@clerk/backend` (ESM namespace exports are not spyable in Vitest).
 */
export function verifyClerkSessionToken(
  token: string,
  secretKey: string,
): ReturnType<typeof verifyToken> {
  const parties = getEnv().CLERK_AUTHORIZED_PARTIES;
  const authorizedParties = parties
    ? parties.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  return verifyToken(token, {
    secretKey,
    ...(authorizedParties?.length
      ? { authorizedParties: authorizedParties as [string, ...string[]] }
      : {}),
  });
}
