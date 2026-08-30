# External calls

Every request the userscript (and the `lib/` client) makes, and what happens when it
fails. There is no telemetry, no analytics, and no runtime code loading. The hosts
contacted are:

| Host | Why | Auth |
|---|---|---|
| `usw.api.sniffies.com`, `uswapi2.sniffies.com`, `uswapi.sniffies.com` | Sniffies profile API | Browser cookies (`credentials: "include"`); no token header exists |
| `sniffies.com` | Auto-message chat tabs (navigation via `GM_openInTab`, not fetch) | Browser session |
| `accounts.google.com` | Drive OAuth consent page (opened as a tab/popup, not fetched) | — (Drive sync only, off by default) |
| `oauth2.googleapis.com` | OAuth token exchange | PKCE code + verifier in the form body |
| `www.googleapis.com` | Drive file create/update/read | `Authorization: Bearer <token>` |

Every fetch goes through `fetchWithTimeout` — an `AbortController` that fires at
**`FETCH_TIMEOUT_MS` = 15,000 ms**, so a stalled endpoint can't wedge the sync UI or
silently consume rate-limit slots forever.

## The inventory

| Call | Where | Method | Auth | Rate limit | Failure handling |
|---|---|---|---|---|---|
| `POST {base}/api/user/partials` | `fetchPartials` | POST | cookies | counted against 6 req/min | Probes bases × body shapes (`userIds` → `profileIds` → `ids` → bare array; ≤ 50 ids per call) until one returns a JSON array, then persists the winning base + shape (allowlist-validated on the next read). Non-OK → `logWarn` with `{base, key, status}`; **429** → `noteRateLimit()` + bail; **401/403** → stop (re-probing with the same cookies only multiplies credentialed failures); thrown fetch → verbose warn, next candidate |
| `POST {origin}/api/user/full` | `fetchFullUser` | POST | cookies | counted against 6 req/min; **one profile per invocation, by design** | Origin failover across the allowlisted set, last-known-good first; winning origin persisted. Same 429/401/403/non-OK policy as partials |
| `POST https://oauth2.googleapis.com/token` | `exchangeGoogleAuthCodeForToken` | POST (form-encoded) | PKCE `code` + `code_verifier` | one per auth flow | Throws with the server's `error_description`/`error` (or HTTP status) when the response lacks `access_token`. Runs only after the callback's `state` matched — a mismatch refuses the exchange and logs a security event |
| `PATCH https://www.googleapis.com/upload/drive/v3/files/{fileId}?uploadType=media` | `syncNotesToGDriveNow` (existing file) | PATCH | Bearer | serialized — concurrent syncs coalesce via a busy/queued latch (prevents double-create orphaning a file) | Outcome logged; a **401** warns and clears the stored token so the next sync re-authenticates |
| `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart` | `syncNotesToGDriveNow` (first sync) | POST | Bearer | as above | Creates `sniffies_data.json` (metadata + JSON parts, random boundary) and persists the returned file id; a create response **without** an id is refused — persisting it would PATCH `/files/undefined` forever |
| `GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media` | Drive load | GET | Bearer | user-initiated | Downloaded content is normalized like an import — ids re-normalized, notes stringified and capped — never trusted wholesale |
| Drive **disconnect** | `clearGDriveToken` | — (no network) | — | — | Local wipe only: token + meta deleted from GM storage and any localStorage remnant. No revoke endpoint is called |
| `GM_openInTab("https://sniffies.com/profile/{id}/chat?sf_automsg=1&…")` | `openAutoMessageChat` | navigation | browser session | 2-min per-profile cooldown (`AUTO_MESSAGE_COOLDOWN_MS`) unless bypassed | Falls back through `GM_openInTab(url, {…})` → `GM_openInTab(url, false)` → `window.open` → same-tab navigation (autoclose off). The URL carries a token the opener tab uses to authenticate the cross-tab "sent" signal |

## Rate limiting (Sniffies API)

The profile endpoints share one self-imposed budget — "the rate limiter is the only
backpressure":

- **`MAX_REQUESTS_PER_MIN` = 6**, rolling, across partials **and** full-user calls;
- **`COOLDOWN_MS` = 600,000** (10 min), tripped by any HTTP 429 and persisted, so a
  reload doesn't reset it; the panel shows remaining budget and cooldown countdown;
- `canRequest()` is checked before every attempt, including mid-probe, so base × shape
  probing can't burst past the cap.

## The `lib/` equivalents

`lib/api.js` implements the same two endpoints with the same posture:

- `createApi().getPartials(ids)` — same bases (`DEFAULT_PARTIALS_BASES`), same four-shape
  probe, 50-id batch, `credentials: "include"`, 15 s timeout; remembers the winning
  base/shape via caller-supplied `remember`/`recall` (the userscript's own localStorage
  keys by default). Exhausting every probe throws `SniffiesAllBasesError` with the
  per-attempt errors; 401/403/429 throw immediately as `SniffiesError`.
- `createApi().getFullUser(id)` — one profile per call, origin failover across
  `DEFAULT_FULL_ORIGINS`, preferred-origin-first.
- `createLimiter()` (`lib/limiter.js`) mirrors the budget: 6/min rolling cap, 1 s minimum
  interval, serialized queue, and a 10-min cooldown opened by `reportRejection()` —
  which `createApi` calls on any 429 or 403.

## The WebSocket is observed, never called

Neither the userscript nor the library opens a WebSocket. `installChatCapture` (userscript)
and `createObserver` (`lib/observe.js`) install a **read-only tap**: a Proxy construct trap
on `WebSocket` (falling back to a `dispatchEvent` patch when the constructor is frozen)
that listens to `message` events on sockets **the site itself opens**, decodes the
Socket.IO framing, and feeds the payloads to the chat-activity extractors. Nothing is ever
sent on a socket; sending a chat message happens through the site's own DOM composer.
