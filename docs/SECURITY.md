# Security

## Threat model

The script runs in the Tampermonkey/Greasemonkey sandbox, in your browser, against
your own session. There is no server component and no telemetry, so the interesting
risks are not "the script phones home" — they are **the page (or another script on
the origin) abusing the script's stored state and globals**, and **your own data
leaving the sandbox** through an export, a sync file, or a log line.

| Threat (STRIDE-ish) | Vector | Mitigation |
|---|---|---|
| Spoofing | Forged cross-tab auto-message signal (localStorage is page-writable) | Signal payloads must carry a token matching a tab handle **this** tab issued (`autoMessageTabHandles`), be of type `sent`, and claim a send time within a ±2-minute freshness window; anything else is rejected and warned about |
| Tampering | Poisoned `localStorage` API-base key redirecting **credentialed** fetches | `validatedApiUrl()` honors a stored base only when its origin is in `ALLOWED_API_ORIGINS` (`usw.api.sniffies.com`, `uswapi2.sniffies.com`, `uswapi.sniffies.com`); anything else falls back to the default. The stored body-shape key is validated against the four known shapes so a value like `"toString"` can't reach `Object.prototype` |
| Tampering | Hostile imported backup JSON or a tampered Drive sync file | Both go through the same normalization as first-party data: profile ids re-normalized, notes coerced to strings and capped at 5,000 chars, bookmarks rebuilt row by row; a non-object notes store is refused. The encrypted-export envelope is validated on decrypt (see below) |
| Repudiation | Silent data destruction on corrupt storage | `noteCorruptStorageKey()` logs the failure unconditionally and copies the raw value to `<key>.corrupt.<timestamp>` before falling back to defaults |
| Information disclosure | Page-realm JS (a future sniffies.com XSS, another extension) reading private data via debug globals | `exposeGlobal(name, value, { sandboxOnly: true })` keeps the value in the sandbox realm only. `sandboxOnly` is **required** for anything that mutates state, triggers network calls, or exposes private data — captured clipboard/selection text, auto-message state, bookmarks. Only read-only debug globals reach `unsafeWindow` |
| Information disclosure | Secrets or PII in console logs | The verbose call-trace helpers mask every string longer than 12 chars as `[str:N]` and redact any key matching `/token\|pass\|secret\|code\|auth\|key\|cred\|cookie\|bearer/i` — see [`logging.md`](./logging.md) |
| Information disclosure | Drive OAuth token readable by page JS | Token + meta live in **GM storage** (`GM_setValue`), never `localStorage`; legacy localStorage copies are migrated into GM storage and purged on load. Disconnect wipes token, meta, and any localStorage remnant |
| Elevation via CSRF | OAuth callback with an attacker-supplied code | PKCE code flow with S256 challenge; the callback's `state` must match the pending session's or the exchange is **refused** and logged as a security event (`OAuth state mismatch — possible CSRF`) |
| Denial of service | Runaway fetches tripping Sniffies' server-side limits | Self-imposed 6 req/min budget, 10-minute cooldown on any 429, 15 s abort timeout on every outbound call — see [`external-calls.md`](./external-calls.md) |

## Trust boundaries

Everything below is treated as **untrusted input**:

- **The page DOM** — selectors are heuristic; extracted text runs through
  `sanitizeMessageText` (whitespace-collapsed, 240-char cap) and image URLs through
  `sanitizeImageUrl` (https-normalized; `data:` and relative paths rejected).
- **Observed network payloads** — the monkey-patched `fetch`/XHR/WebSocket taps feed a
  cycle-safe breadth-first walker with a depth cap; frames over 1.5 M chars are dropped
  before parsing.
- **Imported backup JSON** and the **Google Drive sync file** — normalized field by
  field, never trusted to replace a store wholesale.
- **Cross-tab localStorage signals** — token-authenticated and freshness-checked as
  above, because any script on the origin can write the key.
- **Stored API bases/shapes** — allowlist-validated on every read, because they become
  credentialed fetch targets.

## SES / lockdown posture

Sniffies ships a hardened (frozen-intrinsics) startup. The script:

- **never injects a `<script>` into the page realm** and uses no `eval` / `new Function`;
- wraps `WebSocket` with a **Proxy construct trap** (preserves `new.target`, subclassing,
  `instanceof`, statics), and if the constructor is already replaced or frozen falls back
  to patching `WebSocket.prototype.dispatchEvent` to sniff `message` events;
- marker-guards every patch against double-wrapping, and try/wraps even the marker
  assignment (the constructor may be non-extensible);
- aborts boot entirely if the DOM singleton marker
  (`data-sniffies-soft-filter-active`) shows another runtime already started.

## Export encryption

Export/Import supports optional passphrase encryption:

- **AES-GCM-256**, key derived via **PBKDF2-SHA256 at 210,000 iterations**
  (`EXPORT_ENC_ITERATIONS`), non-extractable `CryptoKey`.
- Fresh **16-byte salt** and **12-byte (96-bit) IV** per export, both stored in a
  self-describing envelope (`version`/`alg`/`kdf`/`iterations`/`salt`/`iv`/`ciphertext`,
  base64).
- Decrypt validates the envelope: version must be ≤ the build's supported version, `alg`
  must be `AES-GCM`, and the iteration count must sit between 100,000 (degenerate/tampered
  floor) and 5,000,000 (DoS ceiling). Old exports decrypt with **their own** recorded
  parameters, so a future parameter bump can't misreport as a wrong passphrase.

## Google Drive OAuth

- **Off by default**: `GOOGLE_CLIENT_ID` is empty in public builds; every Drive code path
  refuses to run until you compile in your own client id and redirect URI.
- **PKCE authorization-code flow** (`code_challenge_method=S256`, `access_type=online` —
  no refresh token), scope limited to `drive.file`.
- `state` is generated per session and verified on callback; a mismatch aborts the token
  exchange and is logged as a possible CSRF.
- Tokens persist in **GM storage only** (default TTL 55 min when the server sends no
  expiry); if GM storage is unavailable the token is kept in memory, a loud warning is
  emitted, and nothing page-readable is written.
- **Disconnect** deletes the token locally (GM storage + any localStorage remnant); it
  does not call a revoke endpoint — revoke at
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions) if you
  want the grant gone server-side.

## Reporting

This is a personally maintained repo. Report issues via GitHub issues on this
repository, or directly to the maintainer.
