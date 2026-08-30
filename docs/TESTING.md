# Testing

```sh
npm test           # userscript suite — vitest + jsdom, boots the whole IIFE
npm run test:lib   # library suite — node:test over test/lib/*.test.mjs, no jsdom
npm run check      # lint + both suites + build:check (the full gate)
```

Two suites, two harnesses, on purpose:

- **The userscript suite** (`test/*.test.mjs`, vitest) tests the shipped IIFE as a whole — booted,
  not unit-extracted. `vitest.config.js` excludes `test/lib/**` so vitest never tries to load the
  node:test files.
- **The library suite** (`test/lib/*.test.mjs`, node:test) imports `lib/*.js` as ordinary ES
  modules and needs no boot at all: `api`, `dom`, `limiter`, and `observe` each get direct
  behavioral tests.

## How the IIFE becomes testable (`test/harness.mjs`)

The userscript is one IIFE with no exports, and `sniffiesplus.js` on disk is **never modified**.
The harness makes it testable entirely in memory:

1. **Resolve the source.** Default to `sniffiesplus.js`. `SNIFFIES_SRC_FILE=<name> npm test`
   overrides the resolution to target any other exported variant.
2. **Derive the surface.** `topLevelFunctionNames()` regex-scans the source for every 2-space-
   indented top-level `function` — direct children of the IIFE. New functions are picked up
   automatically; nothing is registered by hand.
3. **Inject the export.** `buildTestableSource()` splices an assignment just before the IIFE's
   closing `})();` that puts every top-level function, plus a `__state` object of module-state
   handles (`state`, `blocked`, `chatActivity`, `idToMarker`, …), onto
   `window.__SNIFFIES_INTERNALS`. Two details matter:
   - `__state` entries are **getters**, not snapshots — several bindings are *reassigned* (not
     mutated) by their `save*()` helpers, and a snapshot would silently go stale after the first
     reassignment in a test file.
   - The getters are **defensive** — a state handle absent from an older source variant degrades
     to `undefined` instead of throwing at inject time and killing the whole boot.
4. **Boot once per test file.** `test/setup.mjs` prepares jsdom with everything it lacks — real
   WebCrypto, in-memory `GM_*` storage (exposed as `__GM_STORE`), an in-memory `localStorage`
   (`__LS`), a benign default `fetch` for `installChatCapture()` to patch, dialog/navigation
   stubs, a no-op `MutationObserver` — freezes time with fake timers
   (`2026-06-14T22:00:00.000Z`, so no boot `setInterval` ever fires), then runs the built source
   via indirect `eval` in the global scope. Tests call `getInternals()` and get either the
   internals or a useful boot-failure error.

## Coverage philosophy

Meaningful coverage of the important and the changed/risky paths, with real behavioral
assertions — **not** a blanket line-percentage mandate. A line target on this codebase would
reward tests that execute DOM code against stubs and assert nothing. Accordingly,
`vitest.config.js` scopes v8 coverage to `test/**`: `sniffiesplus.js` isn't an imported module, so
line coverage of it would be noise. When you add a top-level function, the harness and smoke test pick
it up automatically; add behavioral assertions wherever the logic is non-trivial.

## What the suite covers

| File | Covers |
|---|---|
| `boot.test.mjs` | the harness booted the IIFE at all |
| `smoke.test.mjs` | calls **every** top-level function and asserts none throws a `ReferenceError` — the missing-global / TDZ class of bug |
| `apply-hiding.test.mjs` | the decision engine's fixed hide ordering and master-switch behavior |
| `hiding-predicates.test.mjs` | the individual `shouldHideBy*` predicates |
| `filters.test.mjs` | filter predicates against chat-activity / marker state |
| `not-online-window.test.mjs` | the last-online window filter and its clamps |
| `attitude.test.mjs` | attitude parsing/inference |
| `parsing.test.mjs` / `chat-capture-parse.test.mjs` | payload parsing from the capture layer |
| `chat-activity.test.mjs` | chat-activity timestamp derivation |
| `global-chat.test.mjs` | Global Chat filtering of hidden/blocked authors |
| `storage-migration.test.mjs` | versioned-key loading, legacy-shape migration, coercion |
| `crypto.test.mjs` | AES-GCM + PBKDF2 export/import round-trips |
| `sanitizers.test.mjs` | input/text sanitizing helpers |
| `rate-limit.test.mjs` | the request budget and cooldown gate |
| `oauth-callback.test.mjs` | the Drive OAuth callback path (PKCE/state handling) |
| `trace-redactor.test.mjs` | log-trace redaction |
| `memory-gc.test.mjs` | `runMemoryGc()` pruning behavior |
| `test/lib/{api,dom,limiter,observe}.test.mjs` | the interaction library, imported directly under node:test |

### Feature-gated suites

`temp-block.test.mjs` and `carousel-hotkeys.test.mjs` cover the temp-block and cruiser-carousel
features. `sniffiesplus.js` contains both, so both suites **run and pass** against the default
source. Each still probes the booted internals for its feature function (`pruneExpiredTempBlocks`,
`getCruiserCarouselIds`) and wraps its suites in `describe.skipIf` as belt-and-suspenders — so
against an `SNIFFIES_SRC_FILE` variant that lacks a feature they **skip instead of fail**, and the
skip count reports which features that target lacks.

## Cold-cache global setup

On a managed Mac an on-access security scanner makes the *first* read of each `node_modules` file
slow (~1–2s), so after a fresh `npm install` jsdom's import chain can take ~50s+ and trip vitest
4.x's hardcoded, non-configurable worker-start timeout. `vitest.config.js` wires
`test/global-setup.mjs`, which warms the OS file cache in vitest's **main process** (where no
worker timeout applies) before any worker boots jsdom. A cold run degrades to "slow once"; warm
runs are unaffected.

## CI

`.github/workflows/ci.yml` runs on every push and pull request: `npm ci` → `npm run lint` →
`npm test`. The library tests and the `dist/` drift check are part of the local gate —
`npm run check` (lint + vitest + `test:lib` + `build:check`) — which is the command to run before
committing; CI does not yet include those two steps. The shipped `sniffiesplus.js` is unaffected
by any of this tooling.
