import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme as useNwColorScheme, vars } from "nativewind";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";

import { getPalette, type ColorScheme, type ThemePalette } from "./tokens";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "cheddr.theme.preference.v1";

interface ThemeContextValue {
  /** User's stored preference (may be "system"). */
  preference: ThemePreference;
  /** Concrete scheme actually being applied. */
  resolved: ColorScheme;
  /** Active color palette for non-NativeWind consumers (Skia, StatusBar). */
  palette: ThemePalette;
  /** True once the persisted preference has been loaded from storage. */
  isReady: boolean;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const { setColorScheme } = useNwColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        const next = isThemePreference(stored) ? stored : "system";
        setPreferenceState(next);
      })
      .catch(() => {
        if (cancelled) return;
        setPreferenceState("system");
      })
      .finally(() => {
        if (cancelled) return;
        setIsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved: ColorScheme = useMemo(() => {
    if (preference === "system") {
      return systemScheme === "light" ? "light" : "dark";
    }
    return preference;
  }, [preference, systemScheme]);

  useEffect(() => {
    if (!isReady) return;
    setColorScheme(resolved);
  }, [resolved, isReady, setColorScheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Best-effort persistence — swallow write failures.
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      palette: getPalette(resolved),
      isReady,
      setPreference,
    }),
    [preference, resolved, isReady, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}

/**
 * NativeWind `vars()` helper used to expose theme values as CSS variables on a
 * root view. Reserved for future per-screen overrides; not required for the
 * default light/dark cycle which Tailwind handles via the `dark:` variant.
 */
export function themeVars(scheme: ColorScheme) {
  const p = getPalette(scheme);
  return vars({
    "--color-accent": p.accent,
    "--color-surface": p.surface,
  });
}
