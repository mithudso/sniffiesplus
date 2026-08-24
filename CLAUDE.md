# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreement

The owner prefers a **proactive** agent. When you identify a recommended or sensible
follow-up action that is in scope and non-destructive, **carry it out without waiting for
confirmation**, then keep going through any further recommendations until none remain —
rather than ending a turn with "I can do X if you'd like." Reserve the ask-first behavior for
genuinely destructive or irreversible actions (e.g. `git push`, dependency installs,
deleting files, changing ticket/branch state). Summarize what you did at the end.

## What this is

A single-file Tampermonkey/Greasemonkey **userscript** for `https://sniffies.com/*` that
soft-hides profile markers by attitude/position, filters profile text, adds chat-age
badges, bookmarks, appointment reminders, quick-phrase intros, and optional Google Drive
sync. There is no application server and no module system — the whole program is one IIFE
that runs in the page.

The entire codebase is one file:

```
Sniffies Soft Filter (Bottom - Vers Bottom)-0.8.1.txt   # ~11,900 lines, ~470 declarations (live counts in INDEX.md)
```

The filename ends in `.txt` (not `.js`) but the content is JavaScript with a
`// ==UserScript==` metadata header.

## Read this first

Lines **14–102** of the userscript contain an authoritative in-file **README + ARCHITECTURE
OVERVIEW** (purpose, user controls, mouse/keyboard shortcuts, data model, Drive-sync notes).
Read that block before doing anything — it is more current than any summary and is not
duplicated here.

For navigating the ~11,900-line file, see **`INDEX.md`** (now at
`~/.claude/skill-consolidation/INDEX.md`) — a line-numbered map of every
region, the core engine, caches, UI builders, interaction handlers, boot sequence, and the
`window.__sniffies*` debug API. Line numbers drift as the file is edited, so **`INDEX.md` is
generated** — regenerate it with `node ~/.claude/skill-consolidation/regen-index.mjs`
(descriptions are curated in that script, not in `INDEX.md`; it reads the source `.txt` from
this folder via its hardcoded `SRC_DIR`, overridable with the `SNIFFIES_SRC_DIR` env var).
`node ~/.claude/skill-consolidation/regen-index.mjs --check` exits non-zero when the index is
stale. When in doubt, grep the symbol name rather than trusting a number.

For the **target site's** DOM/selectors/globals, see **`SITE-INDEX.md`** (also moved to
`~/.claude/skill-consolidation/`) — a reverse-engineering
reference built from a saved snapshot (`Sniffies App _ Map.html` + `_files/`). It documents the
real Sniffies map DOM (marker structure, profile-ID encoding, attitude icons, `data-testid`
inventory), `window.SNIFFIES` config, `/api/*` endpoints, the MapLibre map, and a table
cross-referencing each site element to the userscript function that targets it. Sniffies is an
**Angular 21 + MapLibre GL** app; never select on `_ngcontent-ng-cNNN` hashes (per-build).
`SITE-INDEX.md` is a frozen snapshot reference — hand-maintained, not generated.

## Build / lint / test

There is **no build step** — the `.txt` ships as-is. Quick syntax check: copy to a `.js` name
first (Node refuses `node --check` on a bare `.txt`): `cp '<file>.txt' /tmp/sf.js && node --check /tmp/sf.js`.

**Automated tests** (dev-only; the userscript itself stays dependency-free):

```
npm install        # one-time: vitest + jsdom (devDependencies, node_modules gitignored)
npm test           # run the suite once
npm run test:watch # watch mode
```

- The script is one IIFE with no exports, so `test/harness.mjs` reads the `.txt`, injects an
  internals-export before the IIFE close (in memory — **the `.txt` is never modified**), and
  `test/setup.mjs` boots it once per file in jsdom + WebCrypto + GM/fetch mocks + fake timers.
  Tests then call internals via `getInternals()`.
- `test/*.test.mjs`: behavioral suites (parsing, filter predicates, chat-activity, crypto,
  trace redactor) plus `smoke.test.mjs`, which calls **every** top-level function and asserts
  none throws a `ReferenceError` (catches missing-global / TDZ bugs).
- If you add a top-level function it's auto-picked-up by the harness (derived from the source);
  add behavioral assertions where the logic is non-trivial.
- **Cold-cache note:** on a managed Mac an on-access security scanner makes the *first* read of
  each `node_modules` file slow (~1-2s), so a fresh `npm install` can make jsdom's import take
  ~50s+ and trip vitest 4.x's hardcoded (non-configurable) worker-start timeout. `vitest.config.js`
  wires a `globalSetup` (`test/global-setup.mjs`) that warms the file cache in the main process
  first, so a cold run degrades to "slow once" instead of failing; warm runs are unaffected.

**Manual / integration verification** (for DOM, network, and UI behavior tests can't cover):

1. Open Tampermonkey → paste/replace the script (or point it at this file).
2. Reload `https://sniffies.com`.
3. Click **"Show Filter"** (top-right launcher) and exercise the affected panel.
4. Use the `window.__sniffies*` debug globals (below) from the browser console to inspect
   runtime state.

## This `.txt` is the canonical source — edit it directly

This is a personally-maintained script with **no upstream source**; the owner hand-edits
this single `.txt` directly. The `__spreadValues` / `__spreadProps` helpers at the top (and
the sparse inline comments) are esbuild-style artifacts, but there is no build step in this
workflow — do not look for or assume a separate source project. All changes go in this file.

## Version bumping touches 4 places

When changing the version, update all of these (they are not auto-synced):

1. The **filename** (`...-<version>.txt`, currently `...-0.8.1.txt`).
2. `// @version` header (line 4).
3. `// @last-change` header date (line 5).
4. The final `logInfo("Sniffies soft filter loaded (vX.Y.Z)")` call (last line).

## Architecture (big picture)

Single IIFE, `"use strict"`, structured as: tuning constants → storage load/save helpers →
crypto → engine → chat capture → UI panels → boot. Key pieces:

- **Singleton guard** — boot aborts if a DOM marker attribute
  (`data-sniffies-soft-filter-active`) shows another runtime already started. Prevents
  double-execution when the script loads twice.
- **Decision engine** — `applyHiding()` is the core; it runs hide/show/highlight in a
  **fixed deterministic order**: blocked → text-exclude → recent-chat hide → any-chat hide →
  missing-chat-history hide → not-online hide → attitude rules → highlights. Preserve this
  ordering when modifying filter logic. Fed by `scanMarkers()`
  (indexes map markers into `idToMarker`), `updatePartials()`/`fetchPartials()` (hydrate
  attitude snippets), and `refreshFullProfileText()` (hydrate text for include/exclude).
- **Interaction capture** — `installChatCapture()` monkey-patches `fetch`, `XMLHttpRequest`,
  and `WebSocket` payload paths to derive chat-activity timestamps and message snippets.
  This is how "chatted in last 24h / ever" filters and chat-age badges work.
- **Maintenance** — `runMemoryGc()` prunes stale caches/timers/preview data on an interval
  to bound memory growth. Many TTL/retention constants at the top govern this.
- **UI** — `buildPanel()`, `renderMatchPanel()`, `renderBookmarkPanel()`,
  `renderAppointmentPanel()` build draggable floating panels whose positions persist.

## Storage conventions

- **State lives in `localStorage`** (local-only) unless Drive sync is manually enabled.
- Keys are **versioned and use multi-key fallback arrays** for migration, e.g.
  `STATE_KEYS = ["sniffiesSoftFilterState_v2", "..._v1", "..."]`. Loaders read the newest
  key that exists; writers write the newest. When adding/changing a stored shape, bump the
  version and prepend the new key — don't rewrite old keys in place.
- **Drive OAuth tokens use Tampermonkey GM storage** (`GM_getValue`/`GM_setValue`), not
  `localStorage`, so they aren't page-readable. Access via the `gmGetValueSafe`/
  `gmSetValueSafe` wrappers.
- **Export/Import** supports optional passphrase encryption via **AES-GCM + PBKDF2**
  (`encryptStringWithPassphrase` / `decryptStringWithPassphrase`).

## Constraints to respect when editing

- **SES / lockdown compatibility** — Sniffies ships a hardened (frozen-intrinsics) startup.
  The script deliberately **avoids page-context injection**. Do not add code that injects
  `<script>` into the page or relies on reaching into the page's realm; keep work in the
  userscript sandbox.
- **Rate limiting** — profile/partial fetching is throttled (`MAX_REQUESTS_PER_MIN`,
  `COOLDOWN_MS`, scan/apply intervals). Respect these when adding network calls; don't
  bypass the limiter.
- **Google Drive sync is off by default** in public builds: `GOOGLE_CLIENT_ID` is empty.
  OAuth is PKCE code flow with `state` verification. Enabling requires editing
  `GOOGLE_CLIENT_ID` / `GOOGLE_REDIRECT_URI` constants in-file.

## Debugging from the console

The script exposes ~36 globals via `exposeGlobal(...)` for runtime inspection, all prefixed
`window.__sniffies*` — e.g. `__sniffiesMemoryStats`, `__sniffiesRunMemoryGc`,
`__sniffiesBookmarks`, `__sniffiesAppointments`, `__sniffiesQuickPhrases`,
`__sniffiesChatCaptureDebug`, `__sniffiesRescanChatAges`,
`__sniffiesGetProfileTableData`, `__sniffiesTeardown` (stop all timers/observers). This is only a
sample — grep `exposeGlobal(` (or see INDEX.md's Debug API tables) for the authoritative full list. Logging verbosity
is controlled by `currentLogVerbosity()` (quiet/normal/verbose).
