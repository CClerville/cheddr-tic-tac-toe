import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";

let initialised = false;

/**
 * Idempotent Sentry init for the mobile app. Reads the DSN from
 * `EXPO_PUBLIC_SENTRY_DSN` (so it's bundled into the binary) or from
 * `expoConfig.extra.sentryDsn`. Without a DSN we no-op silently.
 */
export function initSentry(): void {
  if (initialised) return;
  initialised = true;

  const dsn =
    process.env.EXPO_PUBLIC_SENTRY_DSN ??
    (Constants.expoConfig?.extra?.sentryDsn as string | undefined);
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: __DEV__ ? "development" : "production",
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    enableAutoSessionTracking: true,
  });
}

export { Sentry };
