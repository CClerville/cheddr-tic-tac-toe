import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ClerkProvider } from "@clerk/clerk-expo";
import { QueryClientProvider } from "@tanstack/react-query";
import Constants from "expo-constants";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SplashGate } from "@/components/SplashGate";
import { AuthBootstrap } from "@/providers/AuthBootstrap";
import { queryClient } from "@/lib/queryClient";
import { clerkTokenCache } from "@/lib/secureStore";
import { initSentry } from "@/lib/sentry";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

initSentry();

const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  (Constants.expoConfig?.extra?.clerkPublishableKey as string | undefined) ??
  "";

function ThemedStack() {
  const { resolved } = useTheme();
  return (
    <>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          animationDuration: 220,
          freezeOnBlur: true,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="setup" />
        <Stack.Screen name="game" />
        <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
        <Stack.Screen
          name="game-over"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ClerkProvider
          publishableKey={CLERK_PUBLISHABLE_KEY}
          tokenCache={clerkTokenCache}
        >
          <QueryClientProvider client={queryClient}>
            <AuthBootstrap>
              <ThemeProvider>
                <SplashGate>
                  <ErrorBoundary>
                    <ThemedStack />
                  </ErrorBoundary>
                </SplashGate>
              </ThemeProvider>
            </AuthBootstrap>
          </QueryClientProvider>
        </ClerkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
