/**
 * Pure data recipes for neumorphic shadows and glass — compose in components.
 * Colors reference ThemePalette field names; resolve with getPalette(scheme).
 */

import type { ColorScheme } from "./tokens";
import { blur, getPalette, radii } from "./tokens";

export interface NeumorphicShadowRecipe {
  /** Highlight offset (light source top-left) */
  highlight: { dx: number; dy: number; blur: number; color: string };
  /** Soft depth shadow */
  depth: { dx: number; dy: number; blur: number; color: string };
}

/** Skia / RN shadow approximations — use with layered views or Skia ShadowMask */
export function neumorphicCell(
  scheme: ColorScheme,
  pressed: boolean,
): NeumorphicShadowRecipe {
  if (scheme === "dark") {
    if (pressed) {
      return {
        highlight: {
          dx: 1,
          dy: 1,
          blur: 2,
          color: "rgba(255,255,255,0.04)",
        },
        depth: {
          dx: 3,
          dy: 3,
          blur: 8,
          color: "rgba(0,0,0,0.55)",
        },
      };
    }
    return {
      highlight: {
        dx: -2,
        dy: -2,
        blur: 4,
        color: "rgba(255,255,255,0.08)",
      },
      depth: {
        dx: 4,
        dy: 4,
        blur: 10,
        color: "rgba(0,0,0,0.45)",
      },
    };
  }
  if (pressed) {
    return {
      highlight: {
        dx: 1,
        dy: 1,
        blur: 2,
        color: "rgba(255,255,255,0.5)",
      },
      depth: {
        dx: 2,
        dy: 2,
        blur: 6,
        color: "rgba(0,0,0,0.08)",
      },
    };
  }
  return {
    highlight: {
      dx: -3,
      dy: -3,
      blur: 6,
      color: "rgba(255,255,255,0.9)",
    },
    depth: {
      dx: 4,
      dy: 4,
      blur: 12,
      color: "rgba(0,0,0,0.06)",
    },
  };
}

export interface GlassRecipe {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  blurIntensity: number;
  borderRadius: number;
}

export function glassPanel(scheme: ColorScheme, variant: "panel" | "modal"): GlassRecipe {
  const p = getPalette(scheme);
  const intensity = variant === "modal" ? blur.modal : blur.panel;
  return {
    backgroundColor: p.glass,
    borderColor: p.glassBorder,
    borderWidth: 1,
    blurIntensity: intensity,
    borderRadius: variant === "modal" ? radii.xl : radii.lg,
  };
}

export interface NeumorphicButtonElevation {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export function neumorphicButtonRaised(scheme: ColorScheme): NeumorphicButtonElevation {
  if (scheme === "dark") {
    return {
      shadowColor: "#000000",
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    };
  }
  return {
    shadowColor: "#000000",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  };
}

export function neumorphicButtonPressed(scheme: ColorScheme): NeumorphicButtonElevation {
  if (scheme === "dark") {
    return {
      shadowColor: "#000000",
      shadowOffset: { width: 1, height: 1 },
      shadowOpacity: 0.6,
      shadowRadius: 2,
      elevation: 2,
    };
  }
  return {
    shadowColor: "#000000",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  };
}
