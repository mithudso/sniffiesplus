# Architecture

One file, one IIFE, `"use strict"`, no dependencies, no build step. The userscript ships as a
`.txt` (JavaScript with a `// ==UserScript==` header) and runs in the Tampermonkey sandbox on
`https://sniffies.com/*`. Two source variants sit in the repo root: the canonical versioned file
(`Sniffies Soft Filter (Bottom - Vers Bottom)-<version>.txt`) and `sniffiesplus.txt`, a variant of
the same IIFE. Lines **14–120 of the script itself** are the authoritative in-file README +
architecture overview — read that block first; this document is the repo-level map around it.

The script's internal structure, top to bottom: tuning constants → storage load/save helpers →
crypto → decision engine → chat capture → UI panels → boot.

## Data flow

```
       Sniffies page (Angular 21 + MapLibre GL, SES/lockdown startup)
  ──────────────────────────────────────────────────────────────────────
   observation                     enrichment                decision
   ───────────                     ──────────                ────────
   installChatCapture()            scanMarkers()             applyHiding()
   patches fetch / XHR /     ───►  indexes map markers  ───► fixed-order hide/
   WebSocket payload paths;        into idToMarker           show/highlight pass
   derives chat timestamps,                                  over idToMarker
   message snippets, and           updatePartials() /              │
   last-online times               fetchPartials()                 ▼
        │                          hydrate attitude +        UI panels
        ▼                          presence (rate-limited)   buildPanel(),
   chatActivity /                                            renderMatchPanel(),
   profileLastActive maps          refreshFullProfileText()  renderBookmarkPanel(),
        │                          hydrates profile text     renderAppointmentPanel()
        └──────────── shared state (localStorage-backed) ────────────┘
                          pruned on interval by runMemoryGc()
```

## The decision engine

`applyHiding()` is the core. It runs hide/show/highlight in a **fixed deterministic order** per
marker — each rule that fires hides the marker and `continue`s, so earlier rules always win:

```
blocked → text-exclude → recent-chat-24h → recent-chat-2h → any-chat →
missing-chat-history → not-online → repeated-delete → unanswered-out →
attitude rules → highlights (text, attitude)
```

Preserve this ordering when modifying filter logic; tests pin it (`test/apply-hiding.test.mjs`).
Two other engine properties worth knowing:

- **Master switch first.** When `state.enabled` is off the engine re-shows every marker, clears
  highlights, and bails — it never half-filters.
- **Reconcile, not blanket-clear.** Hide decisions run first, tracking every root hidden this
  pass; the hide class is then removed only from stale roots no still-indexed marker resolves to.
  The old clear-then-re-add approach flashed blocked markers visible for up to 10s per sweep.

It is fed by `scanMarkers()` (marker discovery → `idToMarker`), `updatePartials()` /
`fetchPartials()` (attitude + last-active hydration from `POST /api/user/partials`), and
`refreshFullProfileText()` (profile text for the include/exclude keyword filters).

## Interaction capture

`installChatCapture()` monkey-patches `fetch`, `XMLHttpRequest`, and `WebSocket` payload paths —
inside the userscript sandbox, never the page realm — to derive per-profile chat-activity
timestamps, recent message snippets, and last-online (connect/disconnect) times from the partials
feed. This is the data source for every "chatted in last 24h / 2h / ever" filter, the chat-age
badges, and the auto-unhide-on-reply behavior. Observation never mutates: capture wrappers only
read, and parsing errors are swallowed so they can never break a request the app depends on.

## Singleton guard and teardown

Boot stamps `data-sniffies-soft-filter-active` (plus a `...-started-at` timestamp) on `<html>`;
a second load sees the attribute and returns early, so double-injection (userscript + packaged
extension, or a script manager reloading) is a harmless no-op. `teardownSniffies()` — exposed as
`window.__sniffiesTeardown` — stops all timers and observers so a newer runtime can take over the
tab without a page reload.

## Maintenance

`runMemoryGc()` runs on an interval and prunes stale caches, timers, and preview data to bound
memory growth in a long-lived tab. The TTL/retention constants at the top of the file govern it;
`window.__sniffiesMemoryStats` / `window.__sniffiesRunMemoryGc` inspect and force it.

## Constraints

| Constraint | Consequence |
|---|---|
| **SES / lockdown** — Sniffies ships a hardened frozen-intrinsics startup | No page-context injection, ever. No `<script>` insertion, no reaching into the page's realm. All work stays in the userscript sandbox. |
| **Rate limiting** — the partials/profile APIs are the only network surface | Self-imposed budget: `MAX_REQUESTS_PER_MIN = 6`, `COOLDOWN_MS = 10 min` on a 429. New network calls must route through the limiter, never around it. |
| **No build step** | What you paste into Tampermonkey is what you reviewed. The `.txt` is the canonical, hand-edited source. |

## Storage model

- **App state lives in `localStorage`**, local-only unless Drive sync is manually enabled. Keys
  are **versioned with multi-key fallback arrays** — e.g.
  `STATE_KEYS = ["sniffiesSoftFilterState_v2", "sniffiesSoftFilterState_v1", "sniffiesSoftFilterState"]`.
  Loaders read the newest key that exists; writers write the newest. A stored-shape change means
  a new version key prepended to the array, never a rewrite of old keys in place.
- **Google Drive OAuth tokens use Tampermonkey GM storage** (`GM_getValue`/`GM_setValue` via the
  `gmGetValueSafe`/`gmSetValueSafe` wrappers), not `localStorage`, so the page cannot read them.
  OAuth is a PKCE code flow with `state` verification; `GOOGLE_CLIENT_ID` is empty in public
  builds, so sync is off by default.
- **Export/Import** supports optional passphrase encryption: **AES-GCM + PBKDF2** via
  `encryptStringWithPassphrase()` / `decryptStringWithPassphrase()`.

## The interaction library (`lib/`)

`lib/` is a small, dependency-free **ES-module client** for sniffies.com — the same observed
surface the userscript targets (selectors, endpoints, rate budget, Socket.IO frame shapes),
distilled into a reusable, importable API instead of an 12,700-line IIFE. It shares the
userscript's `localStorage` key names for the learned API base/body-shape, and its limiter
mirrors the userscript's 6/min + 10-min-cooldown budget because that ceiling is shared by every
client in the browser. It builds to `dist/` (ESM + `window.Sniffies` IIFE) via
`scripts/build-lib.mjs`; see [`../lib/README.md`](../lib/README.md).

Every selector, endpoint, and frame shape in both codebases traces back to
[`sniffies-dom-and-api.md`](sniffies-dom-and-api.md) — the reverse-engineering reference for the
site, with per-fact OBSERVED/INFERRED confidence markers and a coverage-gaps list. When the site
markup drifts, that file is where the new observation lands first.
