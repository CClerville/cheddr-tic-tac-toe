import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/clerk-expo";

import { ensureAnonIdentity } from "@/lib/auth";
import { setClerkTokenGetter } from "@/lib/api";
import { Sentry } from "@/lib/sentry";

export type AuthIdentityKind = "clerk" | "anon" | "unknown";

export interface AuthBootstrapState {
  /**
   * `true` once the bootstrap has resolved one of:
   *   - a fresh Clerk token (signed in)
   *   - a usable anon identity (signed out)
   *   - the timeout ceiling (network down)
   *
   * Consumers (e.g. SplashGate) can render until this is true.
   */
  ready: boolean;
  identityKind: AuthIdentityKind;
}

const AuthBootstrapContext = createContext<AuthBootstrapState>({
  ready: false,
  identityKind: "unknown",
});

/**
 * Hard ceiling for the splash gate. If the bootstrap takes longer than
 * this we render the app anyway and let in-flight requests surface their
 * own loading/error states. 1.2s is generous enough to cover keychain
 * unlock + a fast Clerk JWKS fetch on a warm cellular connection.
 */
const READY_TIMEOUT_MS = 1200;

/**
 * Wires Clerk into our `authFetch`, eagerly hydrates a session token
 * (so the very first /user/me request after a cold start carries a
 * real Clerk JWT), and bootstraps an anonymous identity if needed.
 *
 * Exposes a context with `{ ready, identityKind }` that the splash
 * gate uses to avoid the brief "anonymous flash" on cold start.
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const [ready, setReady] = useState(false);
  const [identityKind, setIdentityKind] =
    useState<AuthIdentityKind>("unknown");
  const sentryUserSet = useRef(false);

  useLayoutEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      setClerkTokenGetter(() => getToken());
    } else {
      setClerkTokenGetter(null);
    }
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => {
    let cancelled = false;
    const timeoutRef = { current: null as ReturnType<typeof setTimeout> | null };
    /** Sync flag so the timeout callback never sees a stale React `ready` closure. */
    let readyResolved = false;

    function markReady(kind: AuthIdentityKind) {
      if (cancelled) return;
      readyResolved = true;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIdentityKind(kind);
      setReady(true);
      try {
        Sentry.addBreadcrumb({
          category: "auth.bootstrap",
          level: "info",
          message: `ready:${kind}`,
        });
      } catch {
        /* sentry not initialised */
      }
    }

    timeoutRef.current = setTimeout(() => {
      if (!cancelled && !readyResolved) {
        try {
          Sentry.addBreadcrumb({
            category: "auth.bootstrap",
            level: "warning",
            message: "ready:timeout",
          });
        } catch {
          /* */
        }
        markReady("unknown");
      }
    }, READY_TIMEOUT_MS);

    (async () => {
      if (!isLoaded) return;
      try {
        Sentry.addBreadcrumb({
          category: "auth.bootstrap",
          level: "info",
          message: `start:${isSignedIn ? "clerk" : "anon"}`,
        });
      } catch {
        /* */
      }

      if (isSignedIn) {
        try {
          await getToken();
        } catch (err) {
          try {
            Sentry.captureException(err, {
              tags: { area: "auth.bootstrap", phase: "clerk-eager-token" },
            });
          } catch {
            /* */
          }
        }
        if (userId && !sentryUserSet.current) {
          try {
            Sentry.setUser({ id: userId });
            sentryUserSet.current = true;
          } catch {
            /* */
          }
        }
        markReady("clerk");
        return;
      }

      try {
        const anon = await ensureAnonIdentity();
        if (anon && !sentryUserSet.current) {
          try {
            Sentry.setUser({ id: anon.userId });
            sentryUserSet.current = true;
          } catch {
            /* */
          }
        }
        markReady("anon");
      } catch (err) {
        try {
          Sentry.captureException(err, {
            tags: { area: "auth.bootstrap", phase: "anon-mint" },
          });
        } catch {
          /* */
        }
        // Anon mint failed — likely offline. App stays usable for
        // local play; mark unknown so signed-out gating still resolves.
        markReady("unknown");
      }
    })();

    return () => {
      cancelled = true;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isLoaded, isSignedIn, getToken, userId]);

  return (
    <AuthBootstrapContext.Provider value={{ ready, identityKind }}>
      {children}
    </AuthBootstrapContext.Provider>
  );
}

export function useAuthBootstrap(): AuthBootstrapState {
  return useContext(AuthBootstrapContext);
}
