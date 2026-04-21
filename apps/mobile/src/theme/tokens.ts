/**
 * Semantic color tokens. Mirrors the palette in `tailwind.config.js`.
 *
 * Components should generally consume these via NativeWind classes (e.g.
 * `bg-surface dark:bg-surface-dark`). This module exports the same values for
 * non-NativeWind consumers — most importantly the Skia board canvas, which
 * needs raw color strings, and the StatusBar / SafeArea backgrounds in the
 * root layout that must match before NativeWind hydrates.
 */

export type ColorScheme = "light" | "dark";

export interface ThemePalette {
  surface: string;
  elevated: string;
  subtle: string;
  primary: string;
  secondary: string;
  muted: string;
  accent: string;
  accentContrast: string;
  danger: string;
  success: string;
}

const light: ThemePalette = {
  surface: "#fafafa",
  elevated: "#ffffff",
  subtle: "#e4e4e7",
  primary: "#18181b",
  secondary: "#52525b",
  muted: "#a1a1aa",
  accent: "#7c3aed",
  accentContrast: "#ffffff",
  danger: "#dc2626",
  success: "#16a34a",
};

const dark: ThemePalette = {
  surface: "#09090b",
  elevated: "#18181b",
  subtle: "#27272a",
  primary: "#fafafa",
  secondary: "#a1a1aa",
  muted: "#71717a",
  accent: "#a78bfa",
  accentContrast: "#18181b",
  danger: "#f87171",
  success: "#4ade80",
};

export const palettes: Record<ColorScheme, ThemePalette> = { light, dark };

export function getPalette(scheme: ColorScheme): ThemePalette {
  return palettes[scheme];
}
