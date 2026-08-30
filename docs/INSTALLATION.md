# Installation

## Requirements

- A browser + userscript manager pairing from the support matrix in
  [`browser-compatibility.md`](browser-compatibility.md):
  - **Chrome / Edge / Opera** (any Chromium): [Tampermonkey](https://www.tampermonkey.net/) —
    the reference platform.
  - **Firefox**: Tampermonkey or Violentmonkey; Greasemonkey 4+ also works — the
    `gmGetValueSafe` / `gmSetValueSafe` / `gmDeleteValueSafe` wrappers and the tab opener fall
    back to the `GM.*` promise API when the legacy `GM_*` globals are missing.
  - **Safari (macOS) / iOS / iPadOS**: the **Userscripts** app (App Store), then enable it for
    `sniffies.com` in Safari's extension settings. Tampermonkey for Safari also works on macOS.
  - **Android**: Firefox for Android or a Chromium fork with extension support (Kiwi, Edge
    Android) + Tampermonkey. Stock Chrome for Android cannot run userscripts.
  - The script requests these grants (both legacy and GM4 spellings): `GM_openInTab`,
    `GM_getValue`, `GM_setValue`, `GM_deleteValue`, `GM.openInTab`, `GM.getValue`,
    `GM.setValue`, `GM.deleteValue`, `unsafeWindow`.
- On phones/tablets, hiding works by **long-press** (600 ms) on a marker or Global Chat
  message — the touch equivalent of the desktop middle-click.
- Node 20 (`.nvmrc`) **only if you want to run the tests or build the library** — the
  userscript itself (`sniffiesplus.js`) is dependency-free and ships as-is.

## Install

1. Open `sniffiesplus.js` in this repository and copy its entire contents (it is JavaScript
   with a `// ==UserScript==` header).
2. In your manager: **Create a new script**, replace the template with the copied
   contents, save. (Or point Tampermonkey at the raw file URL for auto-updates.)
3. Reload [sniffies.com](https://sniffies.com) and click **"Show Filter"** — the
   top-right launcher.

## Verify

- The **"Show Filter"** launcher appears top-right; clicking it opens the filter panel.
- The console prints `Sniffies soft filter loaded (v<version>)` on boot.
- The debug globals are live — from the console:

```js
__sniffiesMemoryStats()      // cache/timer/observer counts
__sniffiesChatCaptureDebug   // chat-capture patch status
__sniffiesTeardown()         // stop all timers/observers (kill switch)
```

There are ~38 `window.__sniffies*` globals in total; grep `exposeGlobal(` in the script
for the full list. If a second copy of the script loads, boot aborts on the
`data-sniffies-soft-filter-active` singleton marker — check Tampermonkey for duplicates
if the panel never appears.

## Google Drive sync (optional, off by default)

`GOOGLE_CLIENT_ID` is empty in public builds, so every Drive control is inert. To enable,
edit the `GOOGLE_CLIENT_ID` / `GOOGLE_REDIRECT_URI` constants in the script with your own
Google OAuth client (PKCE flow, scope `drive.file`). See
[`SECURITY.md`](./SECURITY.md#google-drive-oauth) for the auth model.

## Upgrade

Paste the new version over the old script. All state lives in `localStorage` under
versioned `sniffiesSoftFilter*` keys with migration fallbacks, so filters, bookmarks,
notes, and appointments survive. The Drive token lives in GM storage and also survives.

## Dev tooling (not needed to run the userscript)

```
npm install         # one-time: vitest + jsdom (devDependencies only)
npm test            # behavioral + smoke suites (boots the IIFE in jsdom)
npm run test:watch  # watch mode
npm run lint        # correctness-focused ESLint
npm run check       # lint + tests + lib tests + build drift check
```

The harness reads `sniffiesplus.js` and injects an internals export **in memory** — the shipped
file is never modified.

## The `lib/` library (dev / embedding artifact)

`lib/` is a dependency-free ES-module client for the same observed Sniffies surface,
bundled by `npm run build:lib` into:

- `dist/sniffies.esm.js` — `import { createClient, createApi, createObserver } from './dist/sniffies.esm.js'`
- `dist/sniffies.global.js` — classic script; exposes everything on `window.Sniffies`

It is not required by, and not loaded from, the userscript. See
[`../lib/README.md`](../lib/README.md).
