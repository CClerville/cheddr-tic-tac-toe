import { useCallback } from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useSSO } from "@clerk/clerk-expo";

/** Required so the OAuth redirect completes back into the app. */
WebBrowser.maybeCompleteAuthSession();

export type SocialSignInResult =
  | { ok: true }
  | { ok: false; cancelled: boolean; message?: string };

/**
 * Google via Clerk `useSSO` (browser sheet). Uses the app scheme + path
 * `sso-callback` (see `expo-auth-session` redirect URI).
 */
export function useGoogleSignIn() {
  const { startSSOFlow } = useSSO();

  return useCallback(async (): Promise<SocialSignInResult> => {
    const redirectUrl = AuthSession.makeRedirectUri({ path: "sso-callback" });
    const { createdSessionId, setActive, authSessionResult } =
      await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
      });

    if (authSessionResult?.type === "cancel" || authSessionResult?.type === "dismiss") {
      return { ok: false, cancelled: true };
    }

    if (createdSessionId && setActive) {
      await setActive({ session: createdSessionId });
      return { ok: true };
    }

    return { ok: false, cancelled: false };
  }, [startSSOFlow]);
}
