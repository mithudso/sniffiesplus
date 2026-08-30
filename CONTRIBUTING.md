# Contributing

## Before you change a selector or endpoint

Read [`docs/sniffies-dom-and-api.md`](docs/sniffies-dom-and-api.md) first. It records
what was actually **observed** on sniffies.com, with a confidence marker on each entry.
Reasoning about the site's markup from the outside is how selector bugs happen.

One rule follows directly: **never select on Angular `_ngcontent-ng-c*` hashes.** They
are per-build and rot on the next deploy. Anchor on `data-testid`, structure, or text.

## What you are editing

- The userscript is one hand-maintained file:
  `Sniffies Soft Filter (Bottom - Vers Bottom)-<version>.txt` (with `sniffiesplus.txt`
  as a second shipped copy — CI tests both). There is **no build step** and no separate
  source project; the `__spreadValues` / `__spreadProps` helpers at the top are
  esbuild-style artifacts, not evidence of one. Edit the `.txt` directly.
- `lib/` is a small ES-module interaction library. It **does** build:
  `npm run build:lib` writes `dist/`. `dist/` is generated — edit `lib/`, never `dist/`.

## Workflow

```sh
npm install
npm run check      # lint + userscript suite + lib suite + build:check
```

Run `npm run check` before opening a PR; CI runs the same thing. The pieces
individually:

- `npm test` — Vitest + jsdom. The harness reads the `.txt`, injects an
  internals-export in memory (the file is never modified), and boots the IIFE.
- `npm run test:lib` — `node:test` suite for `lib/`.
- `npm run lint` — correctness-focused ESLint.
- `npm run build:check` — rebuilds `dist/` and fails if it drifts from what's committed.

## Version bumping touches 4 places

They are not auto-synced. When changing the userscript version, update all of:

1. The **filename** (`...-<version>.txt`).
2. The `// @version` header (line 4).
3. The `// @last-change` header date (line 5).
4. The final `logInfo("Sniffies soft filter loaded (vX.Y.Z)")` call.
