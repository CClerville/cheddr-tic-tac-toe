import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import promisePlugin from "eslint-plugin-promise";
import securityPlugin from "eslint-plugin-security";

/** Vitest globals when `globals: true` in vitest.config */
const vitestGlobals = {
  describe: "readonly",
  it: "readonly",
  test: "readonly",
  expect: "readonly",
  vi: "readonly",
  beforeAll: "readonly",
  afterAll: "readonly",
  beforeEach: "readonly",
  afterEach: "readonly",
};

/**
 * Shared ESLint base config.
 *
 * - Enforces `@typescript-eslint/no-explicit-any` as `error` (was `warn`).
 * - Adds `import` (cycle/duplicates), `promise` (no-floating), and `security` plugins.
 * - Mobile/api packages can layer additional rules on top via their own `eslint.config.mjs`.
 */
export default [
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    plugins: {
      "@typescript-eslint": tseslint,
      import: importPlugin,
      promise: promisePlugin,
      security: securityPlugin,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    settings: {
      "import/resolver": {
        node: { extensions: [".js", ".jsx", ".ts", ".tsx"] },
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",

      // import hygiene
      "import/no-duplicates": "error",
      "import/no-self-import": "error",
      "import/no-cycle": ["error", { maxDepth: 10, ignoreExternal: true }],

      // promise correctness
      "promise/no-return-wrap": "error",
      "promise/param-names": "error",
      "promise/catch-or-return": "warn",

      // security signals (warn-only; some are noisy)
      "security/detect-eval-with-expression": "error",
      "security/detect-non-literal-require": "warn",
      "security/detect-unsafe-regex": "warn",

      // forbid bare `console.*` in product code -- every package has a
      // structured logger (`apps/api/src/lib/logger.ts`, etc) that emits
      // queryable JSON records. Tests and CLI scripts get an exception
      // (see overrides below).
      "no-console": "error",
    },
  },
  {
    files: [
      "**/__tests__/**/*.{ts,tsx}",
      "**/*.{test,spec}.{ts,tsx}",
    ],
    languageOptions: {
      globals: vitestGlobals,
    },
    rules: {
      // tests often touch private surface; relax a few rules
      "@typescript-eslint/no-explicit-any": "off",
      "security/detect-non-literal-require": "off",
      "no-console": "off",
    },
  },
  {
    files: ["**/scripts/**/*.{ts,tsx,js,mjs}"],
    rules: {
      "no-console": "off",
    },
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".turbo/**",
      ".expo/**",
      "coverage/**",
    ],
  },
];
