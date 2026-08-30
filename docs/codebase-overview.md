# Codebase overview

Every file in the repository and what it is for. `high_signal_file_index.json` is
the machine-readable twin — update both when adding or removing a top-level file.

This repo is a single-file userscript plus a small ES-module interaction library
and a dev test suite. There is no server and no application backend.

## `(root)`

| File | Purpose |
|---|---|
| `sniffiesplus.js` | The canonical userscript (v0.12.2). One IIFE: tuning constants → storage → crypto → the `applyHiding` decision engine → chat capture (patched fetch/XHR/WebSocket) → UI panels → boot, including temp-block and cruiser-carousel hotkeys. In-file README/ARCHITECTURE at lines 14–110. The vitest harness boots this file by default. |
| `CLAUDE.md` | Authoritative agent/contributor rules: architecture, `applyHiding` ordering, storage conventions, SES constraints, the 3-place version bump. |
| `AGENTS.md` | No repo-local agents; points at the `__sniffies*` debug globals. |
| `GEMINI.md` | The same working rules, for Gemini CLI. |
| `CONTRIBUTING.md` | How to contribute; edit the canonical `sniffiesplus.js` directly. |
| `CODE_OF_CONDUCT.md` | Contributor code of conduct. |
| `README.md` | Project overview, quick start, links to the docs suite. |
| `LICENSE` | MIT. |
| `package.json` | Dev scripts (test / test:lib / lint / build:lib / build:check / check) + devDependencies. The userscript itself is dependency-free. |
| `eslint.config.js` | Flat ESLint: correctness rules over `sniffiesplus.js`, the `lib/` browser modules, and dev tooling. |
| `vitest.config.js` | Vitest+jsdom; excludes `test/lib/**` (node:test); `globalSetup` warms the file cache. |
| `.editorconfig`, `.gitattributes`, `.gitignore`, `.nvmrc` | Repo hygiene / editor / Node pin. |

## `lib/` — interaction library

Read-via-API / write-via-DOM ES-module client, built entirely from the observed
site surface (see `docs/sniffies-dom-and-api.md`). Bundled by `scripts/build-lib.mjs`.

| File | Purpose |
|---|---|
| `index.js` | `createClient` — assembles api + observer + dom + compose over a shared rate limiter. |
| `api.js` | The two HTTP endpoints (partials base×shape probing, full-user origin failover); presence & attitude decoders. |
| `observe.js` | Opt-in fetch/XHR/WebSocket taps (SES-safe, restorable); Socket.IO `42[...]` frame decoder; hostname guard. |
| `dom.js` | Pure DOM helpers: id extraction/normalization, marker/global-chat/carousel selectors and resolvers, route detection. |
| `compose.js` | Composer resolution + message send (no send API — write via DOM). |
| `limiter.js` | 6/min + cooldown rate limiter. |
| `errors.js` | Typed errors. |
| `README.md` | Library overview, module table, usage, build & test. |

## `dist/` — generated bundles (do not edit)

| File | Purpose |
|---|---|
| `sniffies.esm.js` | Generated ESM bundle. |
| `sniffies.global.js` | Generated `window.Sniffies` IIFE bundle. |

Edit `lib/`, then `npm run build:lib`.

## `scripts/`

| File | Purpose |
|---|---|
| `build-lib.mjs` | Zero-dependency concat build of `lib/*.js` → `dist/`; fails on module-order drift, duplicate top-level names, or leaked import/export syntax. |

## `docs/`

| File | Purpose |
|---|---|
| `sniffies-dom-and-api.md` | The site reverse-engineering reference (hosts, endpoints, Socket.IO, DOM, data-testid inventory, auth, gotchas), every entry OBSERVED/INFERRED-tagged. **Read before changing a selector or endpoint.** |
| `ARCHITECTURE.md` | System design and the deterministic hide/show pipeline. |
| `DEVELOPMENT.md` | Setup, commands, workflow, version-bump rule. |
| `TESTING.md` | Test strategy, harness, coverage philosophy, CI gate. |
| `COMPONENTS.md` | Navigable map of the userscript pieces and lib modules. |
| `SECURITY.md` | Threat model and mitigations. |
| `logging.md` | Logging approach, levels, sensitive-data rules. |
| `INSTALLATION.md` | Prerequisites, install, verification. |
| `external-calls.md` | Inventory of every external call with auth/timeout/rate-limit/retry. |
| `high_signal_file_index.json` | Machine-readable twin of this file. |

## `test/`

Two suites. `test/*.test.mjs` run under **vitest+jsdom** and boot the whole
userscript IIFE (via `harness.mjs`'s in-memory internals-export — `sniffiesplus.js`
is never modified). `test/lib/*.test.mjs` run under **node:test** against the library.

| File | Purpose |
|---|---|
| `harness.mjs` | Makes the single-IIFE userscript testable; defaults to `sniffiesplus.js`, overridable via `SNIFFIES_SRC_FILE`. |
| `setup.mjs` | Per-file boot: browser/GM/WebCrypto globals + fake timers + indirect-eval boot. |
| `global-setup.mjs` | Warms the node_modules cache before workers spin up jsdom. |
| `smoke.test.mjs`, `boot.test.mjs` | Function-surface + boot canaries (source-derived counts). |
| `apply-hiding.test.mjs`, `hiding-predicates.test.mjs` | The decision-engine ordering and the individual hide predicates. |
| `filters.test.mjs`, `attitude.test.mjs`, `parsing.test.mjs` | Filter predicates, attitude normalization, timestamp/relative-time parsing. |
| `chat-activity.test.mjs`, `chat-capture-parse.test.mjs`, `global-chat.test.mjs` | Chat-activity derivation, payload capture parsing, global-chat hiding. |
| `crypto.test.mjs`, `storage-migration.test.mjs`, `memory-gc.test.mjs` | Export encryption, versioned-key migration + fallback legs, memory GC. |
| `sanitizers.test.mjs`, `rate-limit.test.mjs`, `oauth-callback.test.mjs`, `not-online-window.test.mjs`, `trace-redactor.test.mjs` | URL/message sanitizers, the request limiter, the OAuth-callback parser, the not-online window, the leak-resistant trace redactor. |
| `temp-block.test.mjs`, `carousel-hotkeys.test.mjs` | Temp-block and cruiser-carousel features; run and pass against `sniffiesplus.js`. `describe.skipIf` skips them against an `SNIFFIES_SRC_FILE` variant that lacks the feature. |
| `lib/*.test.mjs` | node:test suites for the interaction library. |
