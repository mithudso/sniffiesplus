import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.mjs"],
    // Warm the node_modules file cache in the main process before workers boot
    // jsdom, so a cold-cache run degrades to "slow once" instead of tripping
    // vitest's (non-configurable) worker-start timeout. See test/global-setup.mjs.
    globalSetup: ["./test/global-setup.mjs"],
    include: ["test/**/*.test.mjs"],
    // The interaction-library suites (test/lib/**) use node:test, not vitest, and need no jsdom
    // userscript boot — they run via `npm run test:lib`. Exclude them here so vitest doesn't try to
    // load them as (empty) vitest suites.
    exclude: ["test/lib/**", "node_modules/**"],
    globals: true,
    // The harness boots the whole userscript IIFE per test file; give it room.
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      include: ["test/**"],
      reporter: ["text-summary"],
      // The userscript .txt isn't a module we import directly, so line coverage of it
      // isn't meaningful here; coverage reflects the harness/test code.
    },
  },
});
