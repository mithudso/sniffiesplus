# Logging

## Levels

Verbosity lives in `state.logVerbosity` (`quiet` / `normal` / `verbose`, default
**`quiet`**), set from the panel's log-verbosity selector. Every line carries the
`[SniffiesFilter]` prefix.

| Helper | Console call | Gate |
|---|---|---|
| `log(...)` | `console.debug` | `verbose` only — the call-trace firehose |
| `logInfo(...)` | `console.info` | `normal` or higher |
| `logWarn(...)` | `console.warn` (`WARN` prefix) | **unconditional** |
| `logError(...)` | `console.error` | **unconditional** |

`logWarn` and `logError` deliberately ignore verbosity: operational failures —
a chat-capture patch that didn't apply, GM storage unavailable, a non-OK API
response, a rejected forged cross-tab signal — must be visible at the shipped
default (`quiet`), because a warn gated at `normal` once let core features die
silently. Trace noise stays on `log()`/`logInfo()`, which remain gated.

## The cached-level fast path

`shouldLog(level)` is called from ~400 guard sites on hot paths (per-marker
predicates, the chat-payload BFS), so the resolved level is cached as an integer
(`cachedLogLevelNum`): a guard costs one compare, not two string allocations plus
a `hasOwnProperty` probe. Details that matter when editing:

- `-1` means "not yet resolved"; `refreshLogLevelCache()` re-resolves after any
  `state.logVerbosity` change (`loadState`, import, and the panel handler all go
  through `saveState` → refresh).
- The cache variable is declared with **`var`, not `let`, deliberately**: `shouldLog`
  fires from the `load*()` helpers **during** `let state = loadState()`, while `state`
  is still in its temporal dead zone. `var` hoists to `undefined` (treated as
  unresolved); a `let` binding would throw a TDZ `ReferenceError` and kill the boot.
  `currentLogVerbosity()` try/catches the same window and treats it as `quiet`.

## Call tracing without leaking

At `verbose`, most functions open with `log("→ fnName", traceArgs(arguments))`.
`traceArgs`/`tracePreview` render arguments **leak-resistantly**:

- strings longer than **12 chars** become `[str:N]` — message text, profile text,
  clipboard contents, and tokens never appear verbatim;
- object keys matching `/token|pass|secret|code|auth|key|cred|cookie|bearer/i`
  are replaced with `[redacted]`;
- depth is capped at 2, objects at 12 keys, calls at 8 args; DOM elements render
  as `<tag>`; a throwing getter or circular reference yields `[unreadable]`
  instead of crashing the logger;
- both helpers are excluded from tracing themselves (they would recurse).

## Corrupt storage is logged, never silently destroyed

`noteCorruptStorageKey(key, raw, err)` is the shared handler for every persisted-state
loader. A `JSON.parse` failure used to be swallowed and the next `save*()` overwrote the
corrupt-but-maybe-recoverable value with an empty default. Now the failure is logged
unconditionally (`logError`) and the raw value is copied to `<key>.corrupt.<timestamp>`
(capped at 500 KB) **before** the loader falls back to defaults.

## Every external call logs its outcome

This is a rule, not a convention — error and catch branches log:

- `fetchPartials` / `fetchFullUser` log every non-OK response
  (`logWarn("fetchPartials non-OK", { base, key, status })` /
  `logWarn("fetchFullUser non-OK", { base, status })`); a thrown fetch logs at
  verbose (`"fetchPartials failed"` with base and message); a 429 records the
  rate-limit hit before bailing.
- Drive sync logs create/update/load outcomes, including the guard for a create
  response with no file id ("sync not persisted").
- An **OAuth `state` mismatch is logged as a security event** via `logError`
  (`"OAuth state mismatch — possible CSRF; token exchange refused"`) — it is not a
  soft failure.
- GM-storage unavailability (token would not survive reload) warns loudly rather
  than degrading silently.

## What is never logged

- **Secrets**: the Drive access token, OAuth codes, PKCE verifiers — the trace
  redactor's key pattern covers them, and no success path prints token material.
- **PII / content**: chat message text, notes, clipboard captures, and profile
  free-text only ever pass through `tracePreview`, where the 12-char mask reduces
  them to `[str:N]`. Status/diagnostic lines identify profiles by id (often
  truncated), not by content.
