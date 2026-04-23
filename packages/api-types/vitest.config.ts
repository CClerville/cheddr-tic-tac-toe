import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/__tests__/**", "src/**/*.d.ts"],
      // Schemas are mostly declarative Zod definitions — focus thresholds on
      // statements/lines/branches. Functions stay low until we add helpers.
      thresholds: {
        lines: 80,
        functions: 0,
        branches: 70,
        statements: 80,
      },
    },
  },
});
