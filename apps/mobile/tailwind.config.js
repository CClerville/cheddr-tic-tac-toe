/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#18181b",
          light: "#27272a",
        },
        accent: {
          DEFAULT: "#a78bfa",
          muted: "#6b7280",
        },
      },
    },
  },
  plugins: [],
};
