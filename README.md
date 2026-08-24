# Sniffies Plus

A Tampermonkey/Greasemonkey userscript for [sniffies.com](https://sniffies.com) that adds soft
profile filtering, chat-age badges, bookmarks, appointment reminders, quick-phrase intros, and
optional Google Drive sync — all client-side, no server component.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or another userscript manager) in your browser.
2. Open [`Sniffies Soft Filter (Bottom - Vers Bottom)-0.11.2.txt`](./Sniffies%20Soft%20Filter%20%28Bottom%20-%20Vers%20Bottom%29-0.11.2.txt), copy its contents, and create a new userscript in Tampermonkey with them (or point Tampermonkey directly at the raw file URL for auto-updates).
3. Reload [sniffies.com](https://sniffies.com) and click **"Show Filter"** (top-right launcher).

## Documentation

The userscript is entirely self-documenting: **lines 14–102 of the script itself** are an
in-file README covering every user control, mouse/keyboard shortcut, the data model, and
Google Drive sync notes. That block is the authoritative, always-current reference — read it
before changing behavior. It is intentionally not duplicated here, since a copy would drift.

## Development

This is a single hand-maintained `.txt` file with **no build step** — it ships as-is. The
`package.json`/`test/` tooling here is dev-only (linting + a Vitest/jsdom test suite that boots
the script's IIFE in memory); it never touches or modifies the shipped `.txt`.

```
npm install        # one-time
npm test            # run the test suite
npm run test:watch  # watch mode
npm run lint         # correctness-focused lint (undefined refs, dupe keys, etc.)
```

See `CLAUDE.md` for the full architecture notes, storage conventions, and constraints (SES/lockdown
compatibility, rate limiting, version-bump checklist) that apply when editing the script.

## License

No license has been chosen yet for this repository — all rights reserved by default until one is
added.
