import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/__tests__/**/*.test.ts"],
    setupFiles: ["./src/__tests__/setup.ts"],
    // PGlite + many harnesses are CPU-heavy; unbounded parallelism can starve
    // individual tests past the default 5s timeout on modest CI runners.
    maxWorkers: 2,
    testTimeout: 10_000,
  },
});
