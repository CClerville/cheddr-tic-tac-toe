/** @type {import('tailwindcss').Config} */
// Keep hex values in sync with apps/mobile/src/theme/tokens.ts
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#FAFAF7",
          dark: "#0A0A12",
        },
        surfaceTop: {
          DEFAULT: "#FFFFFF",
          dark: "#12121C",
        },
        surfaceBottom: {
          DEFAULT: "#F0EDE6",
          dark: "#06060C",
        },
        elevated: {
          DEFAULT: "rgba(255,255,255,0.72)",
          dark: "rgba(255,255,255,0.08)",
        },
        subtle: {
          DEFAULT: "rgba(0,0,0,0.06)",
          dark: "rgba(255,255,255,0.10)",
        },
        primary: {
          DEFAULT: "#1C1C24",
          dark: "#E8E8F0",
        },
        secondary: {
          DEFAULT: "#52525b",
          dark: "#A1A1AA",
        },
        muted: {
          DEFAULT: "#6B6B7C",
          dark: "#8888A0",
        },
        accent: {
          DEFAULT: "#D97706",
          dark: "#F59E0B",
          contrast: {
            DEFAULT: "#FFFFFF",
            dark: "#1C1200",
          },
        },
        brand: {
          DEFAULT: "#D97706",
          dark: "#F59E0B",
          contrast: {
            DEFAULT: "#FFFFFF",
            dark: "#1C1200",
          },
        },
        playerX: {
          DEFAULT: "#4F46E5",
          dark: "#818CF8",
        },
        playerO: {
          DEFAULT: "#0891B2",
          dark: "#22D3EE",
        },
        win: {
          DEFAULT: "#D97706",
          dark: "#FBBF24",
        },
        loss: {
          DEFAULT: "#DC2626",
          dark: "#F87171",
        },
        danger: {
          DEFAULT: "#DC2626",
          dark: "#F87171",
        },
        success: {
          DEFAULT: "#16a34a",
          dark: "#4ade80",
        },
        glass: {
          DEFAULT: "rgba(255,255,255,0.72)",
          dark: "rgba(255,255,255,0.10)",
        },
        glassBorder: {
          DEFAULT: "rgba(0,0,0,0.06)",
          dark: "rgba(255,255,255,0.10)",
        },
      },
    },
  },
  plugins: [],
};
