import { InteractionManager } from "react-native";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import { useAuthBootstrap } from "@/providers/AuthBootstrap";
import { ProfileSchema, type Profile } from "@cheddr/api-types";

export interface UseProfileOptions {
  /**
   * Defer fetching until interactions have settled. Default `true` for the
   * tab screen so first-paint isn't blocked by a JS-thread network kick;
   * pass `false` for modal / route-level usage where the user explicitly
   * navigated to the profile.
   */
  deferUntilIdle?: boolean;
  /**
   * Fetch even when the user is anonymous. Default `false` — the (tabs)
   * profile uses a signed-out CTA instead, but legacy callers (e.g. a
   * modal entry point) may want to surface the anon row.
   */
  includeAnon?: boolean;
}

export interface UseProfileResult {
  data: Profile | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  /** True when the underlying React Query subscription is active. */
  enabled: boolean;
}

/**
 * Single source of truth for `/user/me`.
 *
 * Both the legacy modal screen and the new (tabs) screen used to inline
 * this same `useQuery` with subtly different `enabled` conditions, which
 * meant every change had to be made in two places. Centralizing here
 * keeps cache keys and gating consistent.
 *
 * The query key (`["user", "me", userId|"signed-out"]`) is shared with
 * `useRankedGame`, which invalidates it on every ranked terminal game so
 * ELO updates everywhere as soon as you return to a profile surface.
 */
export function useProfile(options: UseProfileOptions = {}): UseProfileResult {
  const { deferUntilIdle = true, includeAnon = false } = options;
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { ready: authReady } = useAuthBootstrap();

  const [interactionsSettled, setInteractionsSettled] = useState(
    !deferUntilIdle,
  );

  useEffect(() => {
    if (!deferUntilIdle) return;
    const task = InteractionManager.runAfterInteractions(() => {
      setInteractionsSettled(true);
    });
    return () => task.cancel();
  }, [deferUntilIdle]);

  // Anon users still have a server-side profile (so leaderboard works for
  // everyone), but most surfaces deliberately hide it. `includeAnon` is
  // the explicit opt-in for legacy callers.
  const enabled =
    interactionsSettled &&
    isLoaded &&
    authReady &&
    (includeAnon ? !isSignedIn || !!userId : !!isSignedIn && !!userId);

  const query = useQuery<Profile>({
    queryKey: ["user", "me", userId ?? "signed-out"],
    queryFn: () => apiGet("/user/me", ProfileSchema),
    enabled,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    enabled,
  };
}
