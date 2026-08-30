# Known issues

Active limitations and deferred findings, with the reasoning for not fixing them
in place. Fixing any of these is a deliberate change with its own review, not a
drive-by.

## Multi-tab last-writer-wins on whole-object stores

**What** — `saveChatActivity` (and the sibling `phraseStats` / `phraseHistory` /
`chatDeletionStats` savers) serialize the entire in-memory map that was loaded at
boot. The script routinely opens same-origin tabs (`GM_openInTab` auto-message
tabs, broadcasts up to many recipients), each running a full copy. Only the single
"sent" event is signalled cross-tab; any *other* activity a secondary tab captures
(e.g. an inbound reply observed there) is overwritten when the opener's next
debounced save rewrites the whole object from its now-stale memory. The lost
reply timestamps are the ones that drive the auto-unhide logic.

**Why deferred** — the fix is a merge-on-save (re-read the stored object and
`max`-merge per id, the same monotonic rule `upsertChatActivity` already uses, or
reload on `storage` events). That change sits on the hot save path; it is a
pre-existing architectural property, not a regression introduced by recent work,
and it deserves its own change + test rather than an in-loop edit. Impact is
bounded: it only loses activity captured *in a secondary tab that the primary tab
did not also observe*, and only until the next time the primary tab re-derives
that activity from its own traffic.

**If you fix it** — implement merge-on-save in `saveChatActivity` first (it drives
auto-unhide), add a test that opens two in-memory stores and asserts a
second-writer's newer reply timestamp survives the first-writer's save, then
extend the pattern to the phrase/deletion savers.

## `docs/sniffies-dom-and-api.md` coverage gaps

The site reference's own **Coverage gaps** section lists what neither the
userscript nor the saved snapshot establishes — most importantly the WebSocket
endpoint URL and event-name catalogue, the real message/conversation schema, the
accepted `/api/user/partials` request key, and the server's actual rate limits.
The `lib/` client treats all of these as best-effort: heuristic resolvers return
`null`/`false` rather than guessing, and the WebSocket is observed read-only, never
driven.
