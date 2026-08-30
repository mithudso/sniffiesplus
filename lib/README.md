# Sniffies interaction library (`lib/`)

A small, dependency-free ES-module client for `sniffies.com`, built **entirely from observed
behavior** — the same reverse-engineering that backs the userscript, distilled into a reusable
surface. Every selector, endpoint, and frame shape here is documented (with a source citation and
an OBSERVED/INFERRED confidence marker) in [`../docs/sniffies-dom-and-api.md`](../docs/sniffies-dom-and-api.md).

This is the Sniffies counterpart to the Grindr `lib/` in the sibling repo.

## The one thing to internalize

Sniffies is a **read via API / write via DOM** app for an outside caller:

- **Read** — the site exposes `POST /api/user/partials` and `POST /api/user/full`, cookie-authed
  (`credentials: "include"`, no token). A same-browser caller inherits the session; there is **no
  out-of-browser login**.
- **Write** — there is **no send-message API**. Messages go over the site's WebSocket from app
  state, so a library sends by driving the composer DOM (fill → click Send → else Enter).
- **Budget** — profile fetches share one self-imposed ceiling (**6 req/min, 10-min cooldown on a
  429**). Route every call through the shared `limiter`; you are not the only client.

## Modules

| Module | Exports | What it does |
|---|---|---|
| `errors.js` | `SniffiesError`, `SniffiesAllBasesError`, `SniffiesTimeoutError` | Typed failures (never carry a cookie/session value in a message) |
| `limiter.js` | `createLimiter` | Serializes calls behind 6/min + a cooldown gate opened by `reportRejection()` |
| `api.js` | `createApi`, `computeLastActiveTs`, `extractAttitudeFromPartial` | The two HTTP endpoints, with base/body-shape probing + failover; presence & attitude decoders |
| `observe.js` | `createObserver`, `decodeSocketFrame`, `isSniffiesApiUrl` | Opt-in fetch/XHR/WebSocket taps (SES-safe, restorable); Socket.IO `42[...]` frame decoder |
| `dom.js` | selectors + `normalizeProfileId`, `route`, marker/global-chat/carousel helpers | Pure DOM helpers; no per-build `_ngcontent` hashes |
| `compose.js` | `findComposer`, `fill`, `clickSend`, `pressEnter`, `sendInCurrentChat` | Heuristic composer resolution + message send |
| `index.js` | `createClient`, `VERSION`, re-exports | The assembled client |

## Usage

```js
import { createClient } from './lib/index.js';

// Read: describe a batch of profile ids (attitude + last-active), rate-limited + cached.
const client = createClient();
const rows = await client.api.getPartials(['660dee38d1ac42d4', '6930ac77f5a006d4']);
const summary = await client.describe(['660dee38d1ac42d4']); // [{ id, attitude, lastActiveTs }]

// Observe live traffic (fetch/XHR/WebSocket) — patches are restorable via client.observer.uninstall().
const live = createClient({
  observe: true,
  onApiJson: ({ url, data }) => console.log('api', url, data),
  onSocketFrame: ({ event, data }) => console.log('ws', event, data),
});

// Write: send in the currently open chat (DOM-driven).
import { compose, dom } from './lib/index.js';
compose.sendInCurrentChat('hey', { skipSelector: '.my-own-ui' });

// DOM helpers.
dom.normalizeProfileId('/profile/660DEE38d1ac42d4'); // '660dee38d1ac42d4'
dom.route();                                         // 'map' | 'profile' | 'profile-chat' | 'global-chat'
dom.attitudeFromMarker(markerEl);                    // 'top' | 'bottom' | 'vers-top' | 'vers-bottom' | null
```

## Build & test

```bash
npm run build:lib    # → dist/sniffies.esm.js + dist/sniffies.global.js (window.Sniffies IIFE)
npm run test:lib     # node --test over test/lib/*.test.mjs
npm run build:check  # rebuilds and fails if dist/ drifted from source
```

The bundles are **generated** — edit `lib/*.js`, never `dist/*`. The build is a zero-dependency
concat (no bundler) that fails loudly on module-order drift, duplicate top-level names, or leaked
`import`/`export` syntax.

## Confidence & gaps

The `docs/` reference marks each fact OBSERVED vs INFERRED and ends with a **Coverage gaps** list —
notably the WebSocket endpoint URL and event-name catalogue, the real message schema, and the
server's actual rate limits are all unestablished. Treat the heuristic DOM helpers
(`findComposer`, `findProfileContainer`-style resolution) as best-effort: they return `null`/`false`
rather than throwing when the markup has drifted.
