# Sniffies Plus

A Tampermonkey/Greasemonkey userscript for [sniffies.com](https://sniffies.com) that adds soft
profile filtering (by attitude/position, profile text, and chat activity), chat-age badges,
bookmarks, appointment reminders, quick-phrase intros, and optional Google Drive sync — all
client-side, no server component.

This repository holds the userscript, a small ES-module **interaction library** (`lib/`) built
from the same observed site surface, and a dev test suite.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or Greasemonkey (4+ supported) in your
   browser.
2. Open `sniffiesplus.js`, copy its contents, and create a new userscript with them.
3. Reload [sniffies.com](https://sniffies.com) and click **"Show Filter"** (top-right launcher).

Full steps, verification, and the Google-Drive-sync note are in
[`docs/INSTALLATION.md`](docs/INSTALLATION.md). Works on Chrome, Edge, Opera, Firefox, Safari
(macOS + iOS via the Userscripts app), and Android extension-capable browsers — including touch
support (long-press = middle-click). Per-browser managers and quirks:
[`docs/browser-compatibility.md`](docs/browser-compatibility.md).

## Documentation

| Doc | What it covers |
|---|---|
| In-file README (userscript lines ~14–110) | Authoritative, always-current: every control, shortcut, the data model, Drive sync. Read it before changing behavior. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Single-IIFE design, the deterministic `applyHiding` pipeline, data flow, storage model. |
| [`docs/sniffies-dom-and-api.md`](docs/sniffies-dom-and-api.md) | The site reverse-engineering reference (DOM, endpoints, Socket.IO, auth). Read before changing a selector/endpoint. |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) · [`docs/TESTING.md`](docs/TESTING.md) | Setup, commands, workflow; test strategy and the CI gate. |
| [`docs/SECURITY.md`](docs/SECURITY.md) · [`docs/logging.md`](docs/logging.md) · [`docs/external-calls.md`](docs/external-calls.md) | Threat model; logging approach; every external call. |
| [`docs/COMPONENTS.md`](docs/COMPONENTS.md) · [`docs/codebase-overview.md`](docs/codebase-overview.md) | Navigable maps of the code. |
| [`lib/README.md`](lib/README.md) | The interaction library. |

## The interaction library (`lib/`)

An ES-module client for sniffies.com — **read via the API, write via the DOM** (Sniffies has no
send-message API). It shares the userscript's rate-limit posture and is built from the observed
surface documented above.

```js
import { createClient } from './lib/index.js';
const client = createClient();
const summary = await client.describe(['660dee38d1ac42d4']); // [{ id, attitude, lastActiveTs }]
```

Build the bundles with `npm run build:lib` (→ `dist/sniffies.esm.js` and the `window.Sniffies`
IIFE `dist/sniffies.global.js`). See [`lib/README.md`](lib/README.md).

## Development

The userscript is a single hand-maintained `sniffiesplus.js` with **no build step** — it ships
as-is. The `package.json`/`test/` tooling is dev-only and never modifies the shipped file.

```sh
npm install         # one-time
npm run check       # lint + vitest (boots the IIFE) + lib tests + bundle-drift check
npm test            # vitest only
npm run test:lib    # node:test over lib/
npm run build:lib   # regenerate dist/ from lib/
```

See [`CLAUDE.md`](CLAUDE.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md) for the architecture notes,
storage conventions, SES/lockdown and rate-limit constraints, and the version-bump checklist that
apply when editing the script.

## License

[MIT](LICENSE).
