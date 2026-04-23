import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * EAS / OTA: set `EAS_PROJECT_ID` or `EXPO_PUBLIC_EAS_PROJECT_ID` (GitHub Actions: repository variable `EXPO_PROJECT_ID` as `EAS_PROJECT_ID` env).
 * Run `eas init` locally once, then add the project UUID to GitHub repo Variables.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId =
    process.env.EAS_PROJECT_ID?.trim() ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
    "";

  const existingExtra = (config.extra ?? {}) as Record<string, unknown>;
  const existingEas = (existingExtra.eas ?? {}) as Record<string, unknown>;

  /** PEM path from EAS env — enables verified OTA bundles. See Expo code signing docs. */
  const codeSigningCertificate =
    process.env.EAS_UPDATE_CODE_SIGNING_CERTIFICATE?.trim();

  return {
    ...config,
    name: config.name ?? "Cheddr Tic-Tac-Toe",
    slug: config.slug ?? "cheddr-tic-tac-toe",
    runtimeVersion: { policy: "appVersion" },
    ...(projectId
      ? {
          updates: {
            url: `https://u.expo.dev/${projectId}`,
            ...(codeSigningCertificate
              ? { codeSigningCertificate }
              : {}),
          },
          extra: {
            ...existingExtra,
            eas: { ...existingEas, projectId },
          },
        }
      : {}),
  } as ExpoConfig;
};
