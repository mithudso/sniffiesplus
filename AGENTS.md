# Agents

This repository defines no repo-local agents. It is one userscript file plus a
small ES-module library and a dev test suite — no server, no MCP servers, no
orchestration.

The tooling that matters is inside the script itself: ~38 debug globals exposed
via `exposeGlobal(...)`, all prefixed `window.__sniffies*`, so runtime state can
be inspected directly rather than inferred from code.

| Surface | What it answers |
|---|---|
| `__sniffiesMemoryStats` / `__sniffiesRunMemoryGc` | cache/timer/preview sizes and a forced GC pass |
| `__sniffiesChatCaptureDebug` | what the fetch/XHR/WebSocket taps have captured (self-ids, URL map) |
| `__sniffiesGetProfileTableData` | per-profile resolved attitude / chat-age / notes for on-map ids |
| `__sniffiesRescanChatAges` | recompute the chat-age badges |
| `__sniffiesGetSettings` | the current filter/toggle state snapshot |
| `__sniffiesTeardown` | stop every timer, observer, tracked listener, and restore patched intrinsics |

Grep `exposeGlobal(` for the authoritative list (or see `INDEX.md`'s Debug API
tables where present). Globals that read private data or mutate state are marked
`{ sandboxOnly: true }` so they never reach the page realm.

## For any agent working here

1. **Check `docs/sniffies-dom-and-api.md` before forming a DOM/API theory.** It
   records what was *observed* about Sniffies' markup and endpoints, with a
   confidence marker on every entry. Most bugs in this class of project came from
   reasoning about the surface from the outside and being wrong.
2. **A resolver that cannot identify its target returns `null`/`false`**, never a
   guess — a plausible fallback is how a message reaches the wrong person.
3. **Preserve the `applyHiding()` ordering** (see `docs/ARCHITECTURE.md`).
4. **Version bumping touches 4 places** (see `CLAUDE.md`).

See [`CLAUDE.md`](CLAUDE.md) for the full working rules.
