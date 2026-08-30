# Components

A navigable map of the major pieces — the userscript's regions and the library's modules — with
their key functions. It is deliberately not an API dump: for the exhaustive surface, grep the
symbol name in the source (line numbers drift; the generated line-numbered `INDEX.md` lives
outside the repo at `~/.claude/skill-consolidation/`).

## Userscript (`sniffiesplus.js`)

One IIFE, ordered: tuning constants → storage load/save → crypto → engine → chat capture →
UI panels → boot.

| Component | Key functions / symbols | Purpose |
|---|---|---|
| **Tuning constants** | `MAX_REQUESTS_PER_MIN` (6), `COOLDOWN_MS` (10 min), `SCAN_INTERVAL_MS` (5s), TTL/retention constants | The API budget, scan/apply cadence, cache lifetimes, and GC retention windows. Change behavior here first. |
| **Singleton guard / boot** | `data-sniffies-soft-filter-active` attribute on `<html>`, `teardownSniffies()` | First instance stamps the attribute; a second load returns early. `teardownSniffies()` (`__sniffiesTeardown`) stops every timer/observer so a newer runtime can take over. |
| **Storage layer** | `loadState()`/`saveState()`, `STATE_KEYS` fallback arrays, `gmGetValueSafe`/`gmSetValueSafe` | Versioned multi-key `localStorage` persistence (read newest-first, write newest); GM storage for Drive OAuth tokens so the page can't read them. |
| **Crypto** | `encryptStringWithPassphrase()`, `decryptStringWithPassphrase()` | AES-GCM + PBKDF2 passphrase envelopes for export/import. |
| **Decision engine** | `applyHiding()`, `scanMarkers()`, `shouldHideBy*` predicates, `shouldHideAttitude()`, `highlightMarker()` | The fixed-order hide/show/highlight pass over `idToMarker` (see ARCHITECTURE.md for the order). `scanMarkers()` discovers and indexes map markers. |
| **Profile enrichment** | `updatePartials()`, `fetchPartials()`, `refreshFullProfileText()` | Hydrate attitude, last-active, and full profile text through the rate limiter; feed `attitudeCache`, `profileLastActive`, and the text-filter caches. |
| **Chat capture** | `installChatCapture()` | Sandbox-side monkey-patches of `fetch`/`XHR`/`WebSocket` payload paths; derives chat timestamps, message snippets, and last-online times that power the chat filters and badges. |
| **Global Chat filtering** | `applyGlobalChatHiding()`, `ensureGlobalChatHideObserver()` | Hides Global Chat messages whose author is hidden/blocked on the map; middle-click a message to block its author. |
| **UI panels** | `buildPanel()`, `renderMatchPanel()`, `renderBookmarkPanel()`, `renderAppointmentPanel()` | The main filter panel plus the Include Matches, Bookmarks, and Appointments floating panels — draggable, positions persisted. |
| **Memory GC** | `runMemoryGc()` | Interval pruning of stale caches, timers, and preview data, governed by the retention constants. |
| **Drive sync** | PKCE OAuth flow, `GOOGLE_CLIENT_ID`/`GOOGLE_REDIRECT_URI` constants | Optional; off by default in public builds (empty client id). Tokens in GM storage. |
| **Debug API** | `exposeGlobal(...)` — ~38 `window.__sniffies*` globals | Runtime inspection from the console: `__sniffiesMemoryStats`, `__sniffiesRunMemoryGc`, `__sniffiesBookmarks`, `__sniffiesAppointments`, `__sniffiesChatCaptureDebug`, `__sniffiesRescanChatAges`, `__sniffiesGetProfileTableData`, `__sniffiesTeardown`, … Grep `exposeGlobal(` for the full list. Verbosity via `currentLogVerbosity()` (quiet/normal/verbose). |

## Interaction library (`lib/`)

Dependency-free ES modules; build order `errors → limiter → api/observe → dom → compose → index`
(enforced by `scripts/build-lib.mjs`). Everything traces to
[`sniffies-dom-and-api.md`](sniffies-dom-and-api.md).

| Module | Key exports | Purpose |
|---|---|---|
| `errors.js` | `SniffiesError`, `SniffiesAllBasesError`, `SniffiesTimeoutError` | Typed failures; messages never carry a cookie/session value. |
| `limiter.js` | `createLimiter` → `{ run, reportRejection, cooldownRemainingMs, pending }` | Serializes calls behind 6/min + a 1s minimum interval; `reportRejection()` opens a 10-min cooldown gate. Mirrors the userscript's shared budget. |
| `api.js` | `createApi`, `computeLastActiveTs`, `extractAttitudeFromPartial`, `fetchWithTimeout`, base/shape constants | The two cookie-authed HTTP endpoints (`/api/user/partials`, `/api/user/full`) with base + body-shape probing and failover; presence and attitude decoders. |
| `observe.js` | `createObserver` → `{ install, uninstall }`, `decodeSocketFrame`, `isSniffiesApiUrl` | Opt-in, restorable fetch/XHR/WebSocket taps (SES-safe, sandbox-only); Socket.IO `42[...]` frame decoder. |
| `dom.js` | selector constants, `normalizeProfileId`, `route`, `attitudeFromMarker`, marker / global-chat / carousel helpers | Pure DOM helpers on stable `data-testid` selectors — never per-build `_ngcontent` hashes. Heuristic helpers return `null`/`false` on drifted markup rather than throwing. |
| `compose.js` | `findComposer`, `fill`, `clickSend`, `pressEnter`, `sendInCurrentChat` | The write path: Sniffies has no send-message API, so sending means driving the composer DOM (fill → click Send → else Enter). |
| `index.js` | `createClient`, `VERSION`, re-exports of everything above | Assembles the client: shared limiter, learned-base persistence (userscript-compatible `localStorage` keys), optional observer, and `describe(ids)` convenience. |

## Related docs

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — how the pieces fit and the constraints they live under.
- [`sniffies-dom-and-api.md`](sniffies-dom-and-api.md) — the observed site surface every selector
  and endpoint above comes from, with confidence markers and coverage gaps.
- [`../lib/README.md`](../lib/README.md) — library usage, build, and gaps.
