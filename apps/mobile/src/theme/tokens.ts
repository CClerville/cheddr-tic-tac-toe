/**
 * Design tokens — canonical palette for Skia, StatusBar, and programmatic use.
 * NativeWind classes mirror these values in `tailwind.config.js` (keep hex in sync).
 */

export type ColorScheme = "light" | "dark";

/** Motion durations (ms). Prefer these over magic numbers in Reanimated. */
export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
  pulse: 1200,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Logical blur radii (pt) — map to BlurView intensity in GlassPanel. */
export const blur = {
  panel: 16,
  modal: 28,
} as const;

/** Bottom tab bar height (thumb zone). */
export const tabBar = {
  height: 56,
} as const;

export interface ThemePalette {
  surface: string;
  surfaceTop: string;
  surfaceBottom: string;
  elevated: string;
  subtle: string;
  primary: string;
  secondary: string;
  muted: string;
  /** Brand / CTA — cheddar amber */
  accent: string;
  accentContrast: string;
  danger: string;
  success: string;
  glass: string;
  glassBorder: string;
  playerX: string;
  playerO: string;
  win: string;
  loss: string;
}

const light: ThemePalette = {
  surface: "#FAFAF7",
  surfaceTop: "#FFFFFF",
  surfaceBottom: "#F0EDE6",
  elevated: "rgba(255,255,255,0.72)",
  subtle: "rgba(0,0,0,0.06)",
  primary: "#1C1C24",
  secondary: "#52525b",
  muted: "#6B6B7C",
  accent: "#D97706",
  accentContrast: "#FFFFFF",
  danger: "#DC2626",
  success: "#16a34a",
  glass: "rgba(255,255,255,0.72)",
  glassBorder: "rgba(0,0,0,0.06)",
  playerX: "#4F46E5",
  playerO: "#0891B2",
  win: "#D97706",
  loss: "#DC2626",
};

const dark: ThemePalette = {
  surface: "#0A0A12",
  surfaceTop: "#12121C",
  surfaceBottom: "#06060C",
  elevated: "rgba(255,255,255,0.08)",
  subtle: "rgba(255,255,255,0.10)",
  primary: "#E8E8F0",
  secondary: "#A1A1AA",
  muted: "#8888A0",
  accent: "#F59E0B",
  accentContrast: "#1C1200",
  danger: "#F87171",
  success: "#4ade80",
  glass: "rgba(255,255,255,0.10)",
  glassBorder: "rgba(255,255,255,0.10)",
  playerX: "#818CF8",
  playerO: "#22D3EE",
  win: "#FBBF24",
  loss: "#F87171",
};

export const palettes: Record<ColorScheme, ThemePalette> = { light, dark };

export function getPalette(scheme: ColorScheme): ThemePalette {
  return palettes[scheme];
}
