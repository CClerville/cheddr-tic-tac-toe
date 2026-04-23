import "react-i18next";

import type en from "./locales/en.json";

/**
 * Augments react-i18next's module declaration so calls to `useTranslation()`
 * and `t(...)` are type-checked against the English catalog (treated as the
 * source of truth). Adding a key to `en.json` makes it instantly available
 * to autocomplete/typecheck across the app.
 */
declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof en;
    };
    returnNull: false;
    returnEmptyString: false;
  }
}
