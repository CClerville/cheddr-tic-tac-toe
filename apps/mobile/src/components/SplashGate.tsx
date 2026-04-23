import { View } from "react-native";

import { useAuthBootstrap } from "@/providers/AuthBootstrap";
import { useTheme } from "@/theme/ThemeProvider";
import type { ReactNode } from "react";

interface SplashGateProps {
  children: ReactNode;
}

/**
 * Renders a solid-color splash that matches the resolved theme palette
 * until two things are ready:
 *   1. the persisted theme preference (avoids the NativeWind v4 light/dark
 *      flash documented in their changelog), and
 *   2. the auth bootstrap (avoids a "signed out" flash for users who are
 *      actually signed in but whose Clerk session is still being hydrated
 *      from the keychain).
 *
 * The auth bootstrap has its own internal timeout ceiling, so even on a
 * cold network this splash will not hang the app indefinitely.
 */
export function SplashGate({ children }: SplashGateProps) {
  const { isReady: themeReady, palette } = useTheme();
  const { ready: authReady } = useAuthBootstrap();

  if (!themeReady || !authReady) {
    return (
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{ flex: 1, backgroundColor: palette.surface }}
      />
    );
  }

  return <>{children}</>;
}
