import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";

/**
 * App-wide i18n bootstrap.
 *
 * Goals:
 * - Single point of initialization so the catalogs load before React tries
 *   to render any translated string.
 * - English is the only fully-translated catalog today; we ship locale
 *   detection (via `expo-localization`) and a fallback chain so adding
 *   future catalogs is a pure JSON drop-in.
 * - Strict typing via `Resources` (`./types.ts`) means `t("foo")` is a
 *   compile-time error if `foo` is not in the catalog.
 *
 * NOTE: We pull the user's preferred locale once at boot. Live-switching
 * (eg. responding to OS locale changes without an app restart) is out of
 * scope for the scaffolding; React Query / re-renders will still pick up
 * the language if you call `i18n.changeLanguage()` later.
 */
const SUPPORTED_LANGUAGES = ["en"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function pickLanguage(): SupportedLanguage {
  const tags = Localization.getLocales();
  for (const t of tags) {
    const code = t.languageCode?.toLowerCase();
    if (code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code)) {
      return code as SupportedLanguage;
    }
  }
  return "en";
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: pickLanguage(),
    fallbackLng: "en",
    // React handles escaping; double-escaping breaks JSX.
    interpolation: { escapeValue: false },
    // Keys missing in a non-default catalog should fall through silently
    // rather than rendering "namespace.key" in the UI.
    returnNull: false,
    returnEmptyString: false,
    compatibilityJSON: "v4",
  });
}

export { i18n };
export default i18n;
