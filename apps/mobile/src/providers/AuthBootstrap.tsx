import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-expo";

import { ensureAnonIdentity } from "@/lib/auth";
import { setClerkTokenGetter } from "@/lib/api";

/**
 * Glue component placed inside ClerkProvider that:
 *   - Wires Clerk's `getToken` into our `authFetch` so every request
 *     prefers the Clerk session token when signed in
 *   - Bootstraps an anonymous identity on first launch so the app can
 *     hit authenticated endpoints offline-then-sync style
 *
 * Renders nothing.
 */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      setClerkTokenGetter(() => getToken());
    } else {
      setClerkTokenGetter(null);
    }
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureAnonIdentity();
      } catch {
        // Don't block the UI if the network is unavailable. The app stays
        // playable offline, and we'll retry on next launch / next API call.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // We render children regardless so the app is usable even if the auth
  // bootstrap is still in flight. Components that need a token can await
  // `ensureAnonIdentity()` themselves.
  void ready;
  return <>{children}</>;
}
