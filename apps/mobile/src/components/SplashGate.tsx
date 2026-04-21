import { View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import type { ReactNode } from "react";

interface SplashGateProps {
  children: ReactNode;
}

/**
 * Renders a solid-color splash that matches the resolved theme palette until
 * the persisted theme preference has been hydrated from storage.
 *
 * This avoids the documented NativeWind v4 caveat where the first paint can
 * flash in the wrong color scheme before `useColorScheme()` resolves.
 */
export function SplashGate({ children }: SplashGateProps) {
  const { isReady, palette } = useTheme();

  if (!isReady) {
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
