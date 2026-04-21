/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#fafafa",
          dark: "#09090b",
        },
        elevated: {
          DEFAULT: "#ffffff",
          dark: "#18181b",
        },
        subtle: {
          DEFAULT: "#e4e4e7",
          dark: "#27272a",
        },
        primary: {
          DEFAULT: "#18181b",
          dark: "#fafafa",
        },
        secondary: {
          DEFAULT: "#52525b",
          dark: "#a1a1aa",
        },
        muted: {
          DEFAULT: "#a1a1aa",
          dark: "#71717a",
        },
        accent: {
          DEFAULT: "#7c3aed",
          dark: "#a78bfa",
          contrast: {
            DEFAULT: "#ffffff",
            dark: "#18181b",
          },
        },
        danger: {
          DEFAULT: "#dc2626",
          dark: "#f87171",
        },
        success: {
          DEFAULT: "#16a34a",
          dark: "#4ade80",
        },
      },
    },
  },
  plugins: [],
};
