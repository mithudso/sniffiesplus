// Dev-only lint config (the shipped userscript stays dependency-free and is unaffected by this).
// Flat config. Goal: catch correctness bugs — undefined references, the missing-global / TDZ class the
// smoke test guards, duplicate keys, unreachable code — NOT style. The .txt is esbuild-shaped and
// hand-maintained, so style/unused-var rules are deliberately relaxed.
import globals from "globals";

export default [
  // Ignore deps, coverage, .bak snapshots, iCloud/Finder conflict copies ("name 2.txt") — stale
  // duplicates of the canonical versioned .txt — and the frozen site snapshot's vendor bundles.
  { ignores: ["node_modules/**", "coverage/**", "**/*.bak", "**/* [0-9].txt", "Sniffies App _ Map_files/**", "dist/**"] },

  // The userscript: one browser IIFE, shipped as a .txt. Glob covers every root-level .txt so a
  // renamed variant (e.g. sniffiesplus.txt) still gets no-undef/TDZ linting — the case-sensitive
  // "Sniffies*.txt" silently skipped it.
  {
    files: ["*.txt"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        // Tampermonkey grants + sandbox handle (see the @grant lines in the userscript header).
        GM_getValue: "readonly",
        GM_setValue: "readonly",
        GM_deleteValue: "readonly",
        GM_openInTab: "readonly",
        GM: "readonly",
        unsafeWindow: "readonly",
        chrome: "readonly", // present when hosted as a Chrome extension / via Tampermonkey (typeof-guarded in source)
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "off", // esbuild temp vars (_a/_b/_c) + intentional unused params
      "no-cond-assign": ["error", "except-parens"],
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-func-assign": "error",
      "no-unreachable": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
      "valid-typeof": "error",
      "use-isnan": "error",
      "no-self-assign": "error",
      "no-self-compare": "error",
    },
  },

  // The interaction library: first-party ES modules that run in the browser (fetch, location,
  // getComputedStyle, WebSocket, AbortController). No Node globals.
  {
    files: ["lib/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, unsafeWindow: "readonly" },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-dupe-keys": "error",
      "no-unreachable": "error",
    },
  },

  // Dev tooling: tests (Node + jsdom browser globals + imported Vitest/node:test API), the build
  // script, and the index generator.
  {
    files: ["test/**/*.mjs", "scripts/**/*.mjs", "regen-index.mjs", "eslint.config.js", "vitest.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
];
