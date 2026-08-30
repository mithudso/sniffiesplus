# Working in this repository (Gemini CLI)

A single-file Tampermonkey/Greasemonkey userscript for `https://sniffies.com/*`,
plus a small ES-module interaction library under `lib/`. No build for the
userscript (the `.txt` ships as-is); the library builds to `dist/` with a
zero-dependency concat script.

## Read this before changing a selector or endpoint

[`docs/sniffies-dom-and-api.md`](docs/sniffies-dom-and-api.md) records what was
**observed** about Sniffies' DOM (Angular 21 + MapLibre) and its API, with a
confidence marker on every entry. Check it before forming a theory.

## Rules that came from real failures

1. **Never select on `_ngcontent-ng-c*` hashes** — they are per-build. Angular
   also *destroys* nodes via `*ngIf` (a collapsed cruiser carousel has no cards to
   query).
2. **Never match a control by loose substring.** Anchor the match and keep an
   exclusion list (`NAV_PANEL_SKIP_SELECTOR` excludes the script's own UI).
3. **A resolver that cannot identify its target returns `null`/`false`.**
4. **Preserve the deterministic `applyHiding()` order** — see `docs/ARCHITECTURE.md`.
5. **Evidence over inspection.** If you cannot show a capture or a live check,
   say the claim is unverified.

## Verify

```sh
npm run check      # lint + vitest (boots the IIFE) + lib tests + bundle drift
npm run test:lib   # node:test over lib/
npm run build:lib  # regenerate dist/ from lib/
```

**Version bumping touches 4 places** (filename, `@version` header, `@last-change`
header, and the final `logInfo(...)` call) — see `CLAUDE.md`.
