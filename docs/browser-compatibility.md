# Browser compatibility

The script was developed on Chrome + Tampermonkey on macOS. This page records what changes on
every other supported browser/manager, which quirks are handled in code, and what to install
where. Everything listed as "handled" has a concrete guard in `sniffiesplus.js` — grep the cited
symbol.

## Support matrix

| Browser | Engine | Recommended manager | Status |
|---|---|---|---|
| Chrome (macOS/Windows/Linux) | Chromium | Tampermonkey | Reference platform |
| Edge | Chromium | Tampermonkey (Edge Add-ons store) | Same engine as Chrome; no code differences |
| Opera / Opera GX | Chromium | Tampermonkey (Opera addons or Chrome store) | Same engine as Chrome; no code differences |
| Firefox | Gecko | Tampermonkey or Violentmonkey (Greasemonkey 4 works with caveats below) | Supported; Xray + GM4 handled |
| Safari 16.4+ (macOS) | WebKit | **Userscripts** app (App Store) or Tampermonkey for Safari | Supported; GM4-async APIs handled |
| iOS / iPadOS Safari | WebKit | **Userscripts** app | Supported; touch fallbacks apply |
| Firefox for Android | Gecko | Tampermonkey / Violentmonkey (extension-capable builds) | Supported; touch fallbacks apply |
| Android Chromium forks (Kiwi, Edge Android, Yandex) | Chromium | Tampermonkey | Supported; touch fallbacks apply |
| Chrome for Android / stock Opera Mobile | Chromium | — | **Not supported**: no extension/userscript support in the browser itself |

## Per-engine quirks and how the code handles them

### Chromium (Chrome, Edge, Opera, Kiwi…)

Reference behavior. The userscript sandbox shares the page realm, so `unsafeWindow` assignment,
the `fetch`/`XMLHttpRequest`/`WebSocket` capture patches, and the Proxy construct-trap all work
directly. Nothing engine-specific.

- **Windows/Linux keyboards**: the temp-block modifier accepts **Ctrl as well as Cmd**
  (`isTempBlockModifier`) — Cmd/Meta is impractical off macOS.

### Firefox (Gecko)

- **Xray wrappers**: a sandbox object/function plain-assigned onto `unsafeWindow` is either
  rejected or lands as an opaque wrapper. `exposeGlobal` now routes page-realm exposure through
  Gecko's `exportFunction` / `cloneInto` when they exist, so the page-readable debug globals work;
  Chromium takes the plain-assignment path unchanged.
- **Capture patches**: patching the *sandbox* `window` can succeed while page traffic bypasses it
  (Xray). The script logs a distinct warning ("patched on sandbox realm only") when only one realm
  was reachable; with the `unsafeWindow` grant present, both realms are patched.
- **Greasemonkey 4**: exposes only the promise `GM.*` API. The wrappers (`gmGetValueSafe`,
  `gmSetValueSafe`, `gmDeleteValueSafe`) and the auto-message tab opener fall back to
  `GM.getValue`/`GM.setValue`/`GM.deleteValue`/`GM.openInTab`; the header grants both spellings.
- **`navigator.clipboard.readText`** does not exist for page/userscript content in Firefox — the
  quick-phrase resolver's clipboard fallback is optional-chained and simply skips that source
  (selection and copy-capture still work).

### Safari / WebKit (macOS + iOS Userscripts app)

- **GM APIs**: the Userscripts app implements the async `GM.*` family — covered by the same
  fallbacks as Greasemonkey 4. Tampermonkey for Safari implements `GM_*` directly.
- **Clipboard**: `navigator.clipboard.readText()` prompts for permission and requires a user
  gesture; all clipboard reads here run inside click handlers, and the `execCommand`/selection
  capture path covers refusals.
- **Date parsing**: WebKit is strict about non-ISO date strings; `parseTimestamp` only feeds
  `new Date()` ISO/numeric forms, and relative English strings are parsed by hand.
- **`AbortSignal.any`** (lib only) is feature-detected with a plain-controller fallback for
  Safari < 17.4.
- **Viewport**: `100vh` includes the collapsing URL bar on iOS. The vh-sized panels
  (match/bookmarks/appointments/chat-phrases) get `dvh` overrides behind `@supports`; the soft
  panel is sized in JS by `updateSoftPanelViewportBounds`, which prefers
  `window.visualViewport.height` and re-runs on both `window` **and** `visualViewport` resize
  events (the on-screen keyboard resizes only the visual viewport). The launcher/panels respect
  `env(safe-area-inset-*)`.

### Mobile / touch (any engine)

- **No middle button** → **long-press** (600 ms, cancelled by >12 px finger movement) on a map
  marker or Global Chat message performs the middle-click hide/block. It synthesizes the same
  event `handleMiddleMark` consumes, so the two paths cannot drift. Armed only on coarse-pointer
  devices (`matchMedia("(pointer: coarse)")`) and only for `touch`/`pen` pointers.
- **Long-press follow-through** is suppressed for 700 ms after a long-press fires: Android's
  long-press `contextmenu` is swallowed, and the `click` that iOS fires on finger lift is
  swallowed only when it lands inside the pressed element (so the site doesn't open the profile
  that was just hidden). Later events are never eaten — the window is time-bounded.
- **Panel dragging by touch** needs `touch-action: none` on the drag handles (otherwise the
  browser claims the gesture for scrolling and fires `pointercancel`); applied in the injected
  stylesheet to the match/bookmarks/appointments `.head` handles and the soft panel's first
  `.row` (its actual drag handle). Tap-highlight flash is disabled on the script's own controls.
- **Small screens** (≤ 480 px): panels pin full-width with a margin (`!important`, overriding the
  persisted desktop drag positions on purpose — those positions still apply on wide screens).
- **No hover / no keyboard**: chat-age badges, filters, and panels are all click/tap-driven and
  work as-is; the g/c/n/b/arrow/f hotkeys simply don't apply.

## Known limitations

- **Chrome for Android / most stock mobile browsers** cannot run userscripts at all (no
  extension support) — use Firefox for Android, Kiwi, or iOS Safari + Userscripts.
- **Greasemonkey 4** has no `GM_openInTab`-style *synchronous* tab handle; the auto-message flow
  falls back to `GM.openInTab`/`window.open`, whose handle may be less capable — background-tab
  auto-sends work, but the opener-side close handle can be missing (the tab then closes itself
  via the autoclose URL param).
- **Safari Userscripts app** runs scripts only while the app's extension is enabled per-site;
  first-time users must allow it for `sniffies.com` in Safari's extension settings.
- **Keyboard-shortcut synthesis** (`pressEnterToSend`) depends on the site's own handlers and is
  the last-resort send path on every engine; the Send-button click is preferred everywhere.

## Testing

`test/touch-longpress.test.mjs` covers the long-press arm/fire/cancel logic and the
Ctrl-as-temp-block-modifier equivalence. Engine-specific behavior (Xray export, GM4 fallbacks,
dvh/safe-area CSS) is feature-detected and inert under jsdom; verify those paths manually per the
matrix above (`docs/DEVELOPMENT.md` has the manual loop).
