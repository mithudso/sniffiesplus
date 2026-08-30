# Sniffies external surface — observed inventory

Reverse-engineering reference for `sniffies.com`, assembled from two sources. Every entry cites
its source and a confidence marker.

**Sources**

| Tag | File | Notes |
|---|---|---|
| `US` | `Sniffies Soft Filter (Bottom - Vers Bottom)-0.12.1.txt` (12,545 lines) | Userscript that monkey-patches `fetch`/XHR/`WebSocket` and drives the live DOM. Encodes empirically-derived knowledge. |
| `SNAP` | `Sniffies App _ Map.html` (943 KB) + `Sniffies App _ Map_files/` | Saved DOM snapshot of the map view, 2026‑06‑14. Angular 21.2.12 + MapLibre GL. |

**Confidence**

- **OBSERVED** — literally present in `SNAP`, or explicitly named/handled in `US` code (not a
  heuristic sweep).
- **INFERRED** — derived from a heuristic, a comment, or a cross-source deduction.

> **Snapshot caveat.** `SNAP` was captured with the userscript running:
> `<html data-sniffies-soft-filter-active="userscript" data-sniffies-soft-filter-started-at="2026-06-14T21:15:29.971Z">`
> (`SNAP` `<html>` tag). Any `sniffies-soft-hide` / `sniffies-soft-highlight` class in the snapshot
> is a userscript artifact, **not** site markup. The snapshot also captures only the map route with
> chat closed and the cruiser carousel collapsed.

---

## 1. Hosts & routes

### 1.1 Origins

| Origin | Role | Source | Conf. |
|---|---|---|---|
| `https://sniffies.com` | SPA app origin; all page routes | `US:24,3009,7359,7674,7827,8856`; `SNAP` (49 refs) | OBSERVED |
| `https://usw.api.sniffies.com` | Primary API origin (`/api/user/partials`, `/api/user/full`) | `US:1698-1699,6052,6074` | OBSERVED |
| `https://uswapi2.sniffies.com` | API failover #2 | `US:6053,6075` | OBSERVED |
| `https://uswapi.sniffies.com` | API failover #3 (full-user only; not in the partials list) | `US:6076` | OBSERVED |
| `https://profile.sniffiesassets.com` | Per-profile avatar CDN. **Path encodes the profile id.** | `SNAP` (145 refs); `US:5519` | OBSERVED |
| `https://site.sniffiesassets.com` | Static site assets, default avatars (`/default-avatars/thumbs-v1/...`) | `SNAP` (54 refs) | OBSERVED |
| `https://web.sniffiesassets.com` | Web assets | `SNAP` (1 ref) | OBSERVED |
| `https://content.sniffiesassets.com`, `cdn.sniffiesassets.com`, `cms.sniffiesassets.com` | Content/CDN/CMS asset hosts | `SNAP _files/*.js` | OBSERVED |
| `https://tr.sniffies.com` | Tracking endpoint | `SNAP` (11 refs) | OBSERVED |
| `https://adserver.sniffies.com` | Ad serving | `SNAP _files/*.js` | OBSERVED |
| `https://captcha.sniffies.com` | Captcha (hCaptcha wrapper) | `SNAP _files/*.js` | OBSERVED |
| `https://preprod.sniffies.com` | Pre-production environment (GTM env switch) | `SNAP` offset ~9435 | OBSERVED |
| WebSocket origin | **Unknown.** `webSocketService.connectWebSocket(location)` is called after `serverService.setMapServer(e.lng)` — i.e. socket host is chosen from the user's **longitude** (geo-sharded, matching the `usw*` naming). The concrete URL lives in a lazy chunk not captured in `SNAP`. | `SNAP _files/main-ILPGQBXF.js` | INFERRED |

The `usw` prefix plus longitude-based `setMapServer` implies a geo-region shard family
(`usw` = US-West); other regions likely exist. `US` hardcodes only the `usw*` set. — INFERRED

### 1.2 SPA routes the script distinguishes

| Route pattern | Meaning | Source | Conf. |
|---|---|---|---|
| `/profile/<hex6+>` | Profile pane open for that id | `US:3785,5151,7002,8723` | OBSERVED |
| `/profile/<hex6+>/chat` | 1:1 chat with that profile | `US:3783,7359,7463` | OBSERVED |
| `/global-chat` | Global ("Cruising Update") chat room | `US:3784,7654,7665,7674` | OBSERVED |
| `/map`, `/cruise`, `/app`, `/start`, `/splash`, `/logout`, `/verification`, `/events`, `/join/:referralId`, `/play/:promoId`, `/nsfw-settings*`, `/account-suspended`, `/restricted`, `/i-am-not-a-robot`, `/extra-device`, `/findme`, `/id`, `/pages`, `/social` + social redirects | Angular route table (partial; profile/chat routes live in lazy chunks) | `SNAP _files/main-ILPGQBXF.js` (`path:"…"`) | OBSERVED |
| `<base href="/">` | SPA served from origin root | `SNAP` | OBSERVED |

**Route-state detection helpers (`US`)**

- `getChatContextProfileId()` — `href.match(/\/profile\/([0-9a-f]{6,})(?:\/chat)?/i)` → `US:5151`. OBSERVED
- `isChatRoute(pathname)` — true for `/profile/<hex>/chat` or `/global-chat`; a bare `/profile/<hex>`
  counts **only if a chat composer element is currently in the DOM** (`findChatInputElement()`).
  `US:3779-3787`. OBSERVED
- Userscript-added query params on its own auto-message navigations (not site params):
  `sf_automsg=1`, `sf_msg_ts`, `sf_msg_token`, `sf_msg_autoclose`. `US:198-200,7360-7363`. OBSERVED

---

## 2. HTTP API endpoints

### 2.1 Endpoints the userscript calls directly

#### `POST {base}/api/user/partials`

| Field | Value |
|---|---|
| Method | `POST` |
| Bases tried, in order | `preferredBase` (localStorage), then `https://usw.api.sniffies.com/api/user/partials`, `https://uswapi2.sniffies.com/api/user/partials` |
| Headers | `content-type: application/json` only |
| Auth | `credentials: "include"` — **cookies, no token header** |
| Body | Shape is probed: `{userIds:[…]}` → `{profileIds:[…]}` → `{ids:[…]}` → bare `[…]` array. First shape that returns a JSON **array** wins and is persisted. |
| Batch size | 50 ids per request (`US:6629`) |
| Success test | `Array.isArray(data)` |
| 429 | `noteRateLimit()` then bail (10‑min cooldown) |

Source: `US:6051-6054,6136-6185`. OBSERVED (the multi-shape probe means the *real* accepted key is
not pinned down — see Coverage gaps.)

**Response row shape as consumed**

| Path | Used for | Source | Conf. |
|---|---|---|---|
| `row._id` | Profile id key for the row | `US:6635` | OBSERVED |
| `row.data.profile.extended.sexuality.attitude` | Position/attitude. Read with `hasOwnProperty` so *absent* ≠ falsy. | `US:6188-6196` | OBSERVED |
| `row.data.connectUpdateTime` *(or top-level)* | Presence heartbeat; advances while connected | `US:5158-5188` | OBSERVED |
| `row.data.disconnectTime` *(or top-level)* | Stamped on drop | `US:5158-5188` | OBSERVED |
| `row.data.*` (any string value, depth ≤ 6) | Free-text corpus for include/exclude keyword filters | `US:5700-5726` | OBSERVED |
| any numeric key matching `/distance/i` anywhere in `row.data` | Distance to profile | `US:5731-5755` | INFERRED (key name is discovered by regex, not known) |

`lastActive = min(now, max(connectUpdateTime, disconnectTime))` — `computeLastActiveTs`,
`US:5156-5172`. The comment flags this as an unverified choice ("If a Gate‑2 spot-check shows the
card's 'active X ago' tracks only ONE field, narrow this"). INFERRED

#### `POST {base}/api/user/full`

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `{base}/api/user/full` where base ∈ ordered set: `preferredFullBase`, origin-of-`preferredBase`, origins of the partials list, `https://usw.api.sniffies.com`, `https://uswapi2.sniffies.com`, `https://uswapi.sniffies.com` (de-duped) |
| Headers | `content-type: application/json` |
| Auth | `credentials: "include"` |
| Body | `{"userId": "<profileId>"}` |
| Success test | response parses to a non-null `object` |
| Fields consumed | `fullUser._id`; `fullUser.data.profile` (preferred root) else `fullUser.data` else `fullUser` — walked for all string values → search text; distance via `/distance/i` regex |
| Rate posture | **one profile per invocation**, deliberately, to spread across the budget |
| 429 | `noteRateLimit()` + bail |

Source: `US:6100-6133,6237-6275`. OBSERVED

**Base-failover persistence**

| localStorage key | Stores | Source |
|---|---|---|
| `sniffiesSoftFilterPartialsBase_v1` | last-good partials URL | `US:241,6171` |
| `sniffiesSoftFilterPartialsMode_v1` | last-good body-shape key (`userIds`/`profileIds`/`ids`/`array`) | `US:240,6170` |
| `sniffiesSoftFilterFullUserBase_v1` | last-good full-user origin | `US:242,6125,6175` |

A successful partials call also back-fills `FULL_BASE_KEY` with that base's origin (`US:6172-6176`).
OBSERVED

### 2.2 Endpoints referenced by the app bundle (not called by the script)

| Method | Path | Notes | Source | Conf. |
|---|---|---|---|---|
| ? | `/api/global-message/flag-user-messages` | Global-chat moderation | `main-ILPGQBXF.js` | OBSERVED (path only) |
| ? | `/api/place/flagged` | Place moderation | same | OBSERVED |
| ? | `/api/place/report-message` | Place message report | same | OBSERVED |
| ? | `/api/user/flag` | Report a user | same | OBSERVED |
| ? | `/api/softReload` | App soft reload | same | OBSERVED |
| ? | `/api/v2/soft-reload/update-rooms` | Room-membership refresh | same | OBSERVED |
| ? | `/api/visitor/current/updatedTime` | Current-visitor heartbeat | same | OBSERVED |
| ? | `/api/internal/kvl`, `/api/internal/cbjs/`, `/api/internal/ssp_users/logout` | Third-party (Chargebee/ad SSP) chunks, not Sniffies core | `512-*.js`, `520-*.js` | OBSERVED |

Methods, bodies and response shapes for §2.2 are unknown from these sources.

### 2.3 Traffic-inspection gate

The capture layer only parses a response when the URL contains **both** `sniffies` **and** `/api/`,
and explicitly **excludes** `/api/user/partials` and `/api/user/full` (those are parsed structurally
elsewhere; the generic BFS walker mis-attributes their nested timestamps).
`shouldInspectApiUrl`, `US:5227-5239`. OBSERVED

---

## 3. WebSocket / Socket.IO protocol

### 3.1 Transport

| Fact | Source | Conf. |
|---|---|---|
| The app uses a WebSocket (`webSocketService`, `connectWebSocket(location)`, `isOnlineListener()`, connection status in NgRx under `CONNECTION.{STATUS,IS_CONNECTED}`) | `SNAP _files/main-ILPGQBXF.js` | OBSERVED |
| Socket host selected from the user's longitude via `serverService.setMapServer(e.lng)` before connecting | same | OBSERVED |
| Frames are **Socket.IO / Engine.IO framed** — the script strips a leading `42` and parses the remainder as a JSON `[eventName, data]` tuple | `US:5250-5271` | OBSERVED |
| Numeric-only frames (`"2"`, `"3"` — Engine.IO ping/pong) are dropped: `/^\d+$/` | `US:5259-5260` | OBSERVED |
| Non‑`42` frames beginning `{` or `[` are parsed as raw JSON | `US:5272-5274` | OBSERVED |
| Double-encoded payloads handled: if the parse yields a **string** that itself starts `{`/`[`, it is parsed again | `US:5277-5282` | OBSERVED |
| Frames > 1,500,000 chars are dropped before parsing (jank guard) | `US:5255-5257` | OBSERVED |
| Both **string** and **Blob** frames are handled — Blob via `data.text().then(...)` (duck-typed on `typeof data.text === "function"`) | `US:5287-5306` | OBSERVED |
| Exact socket URL, path (`/socket.io/`?), namespace, EIO version, and event-name catalogue | — | **NOT ESTABLISHED** |

### 3.2 How the script derives data from frames

There is **no event-name allowlist**. Every parsed frame's data argument (`payload[1]`, or `payload[0]`
if the tuple has one element) is fed to `consumeChatPayload`, a **breadth-first walk** (cycle-safe
`WeakSet`, depth cap 7) that at each node runs four extractors. `US:5199-5224`. OBSERVED

| Extractor | What it looks for (normalized keys, alphanumeric-lowercased) | Source |
|---|---|---|
| `detectSelfIds` | keys `selfid`/`myid`/`myuserid`/`myprofileid`/`viewerid`/`currentuserid`/`currentprofileid`/`visitorid`; or objects flagged `isMe`/`isSelf`/`me`/`self === true` | `US:4964-4981` |
| `ingestSummaryTimes` | outbound: `/(lastsent\|lastoutgoing\|mylast\|youlast\|outgoinglast\|sentlast)/`; inbound: `/(lastreceived\|lastincoming\|theirlast\|fromlast\|incominglast\|receivedlast\|lastreply)/`; direction-less: `/(lastmessage\|latestmessage\|lastchat\|latestchat\|lastactivity\|recentmessage\|messagetime)/` | `US:4818-4840` |
| `ingestMessageTime` | timestamp + direction + text for one message event (below) | `US:4844-4896` |
| `ingestDeletedMessageEvent` | deletion markers + actor (below) | `US:4929-4961` |
| `ingestPresenceTimes` | `connectUpdateTime` / `disconnectTime` at `obj.data.*` or top level, keyed by `obj._id` | `US:5175-5196` |

**Message-event field vocabulary (all OBSERVED as *handled*, INFERRED as *actual wire names*)**

| Concept | Keys probed | Source |
|---|---|---|
| Timestamp (priority) | `createdAt`, `sentAt`, `timestamp`, `time`, `date`, `lastMessageAt`, `lastChatAt`, `latestMessageAt`; fallback regex on keys ending in a real time suffix | `US:4762-4786` |
| Message body | `message`, `text`, `body`, `content`, `msg`, `messageText`, `chatText`; also unwraps `{...}.text` | `US:4423-4435` |
| Sender | keys containing `fromid`, `senderid`, `authorid`, `createdbyid`, `ownerid`, `sourceuserid` | `US:4849` |
| Recipient | keys containing `toid`, `recipientid`, `receiverid`, `targetid`, `destuserid` | `US:4850` |
| Peer (the other party) | `otheruserid`, `otherprofileid`, `peerid`, `partnerid`, `targetuserid`, `targetprofileid`, `recipientid`, `touserid`, `profileid`, `cruiserid`, `userid`; then nested `obj.profile`/`obj.user`/`obj.otherUser`/`obj.otherProfile` | `US:4792-4813` |
| Direction (boolean) | `true` on `fromme`/`ismine`/`mine`/`sentbyme`/`outgoing`/`isoutgoing`/`mymessage` → **out**; `incoming`/`isincoming`/`fromthem`/`received`/`isreceived`/`theirmessage` → **in** | `US:4743-4746` |
| Direction (string) | only keys `direction`/`messagedirection`, matched **exactly** against `out\|outgoing\|sent\|fromme\|mine` / `in\|incoming\|received\|fromthem` | `US:4750-4754` |
| Deletion markers | `deletedat`/`removedat`/`retractedat`/`unsentat` with a parseable ts; boolean-ish `deleted`/`isdeleted`/`removed`/`isremoved`/`retracted`/`isretracted`/`unsent`/`isunsent`/`messageDeleted`; or a `status`/`state`/`messagestatus`/`delivery` string containing `deleted\|removed\|retracted\|unsent` | `US:4911-4926` |
| Deletion actor | `deletedbyid`, `removedbyid`, `actorid`, `deleterid`, `retractedbyid`, `unsentbyid` | `US:4898-4909` |
| Message id (for dedupe) | `messageid`, `chatmessageid`, `threaditemid`, `eventid`, `entryid`, or `obj.message`'s id | `US:4938` |
| Id extraction from any object | `profileId \|\| userId \|\| cruiserId \|\| id \|\| _id \|\| user._id \|\| profile._id` | `US:4443-4452` |

**Timestamp coercion** (`parseTimestamp`, `US:3061-3095`) accepts `Date`, numbers by magnitude
(`>1e15` µs, `>1e12` ms, `>1e9` s, else 0), all-digit strings, ISO strings, relative English
("5m ago", "yesterday"), Firestore `{seconds,nanos}`, and Mongo `{$date}`. This breadth is itself
evidence the wire format was never pinned down. OBSERVED

**Direction resolution order** — explicit flag → `selfProfileIds` membership on from/to → URL-route
context id. Unresolved direction records only an `anyLastTs` (never fabricates my/their), because the
reply-detection test is a strict `theirLast > myLast`. `US:4852-4895`. OBSERVED

### 3.3 Patch mechanics (relevant to a library)

- `WebSocket` is wrapped with a **`Proxy` construct trap** (`Reflect.construct`), preserving
  `new.target`, subclassing, `instanceof`, prototype chain and statics. `US:5443-5459`. OBSERVED
- Fallback when the constructor is already replaced/frozen: patch
  `WebSocket.prototype.dispatchEvent` and sniff `event.type === "message"`. `US:5462-5475`. OBSERVED
- `fetch`, `Response.prototype.json`, and `XMLHttpRequest.{open,send}` are patched too; a
  `__sniffiesChatSeen` marker on the Response dedupes the fetch-clone path against the
  `Response.json` path so a body is captured exactly once. `US:5320-5435`. OBSERVED
- Patches are applied to **both** the sandbox `window` and `unsafeWindow` when present, guarded by
  a per-realm `__sniffiesChatCapturePatched` flag. `US:5485-5507`. OBSERVED
- Supplementary source: `localStorage` values whose **key** matches
  `/(chat|message|inbox|conversation|thread|dm|socket)/i` are periodically parsed as cached chat
  payloads (every 60 s; values > 8 MB skipped). `US:186-190`. OBSERVED

---

## 4. DOM: map & markers

### 4.1 Marker structure (from `SNAP`, verbatim shape)

```
div.mgl-marker.maplibregl-marker.maplibregl-marker-anchor-center.marker-level-<N>
  [aria-label="Map marker"] [role="button"]
  style="transform: translate(-50%,-50%) translate(Xpx,Ypx) rotateX(0deg) rotateZ(0deg); opacity:1;"
└ div[data-testid="markerUserContainer"].marker-container.user
    id="<24-hex profile id>"
    apphoverinteraction=""
    data-within-radius="false"
    data-distance-miles="8.953049511297197"
  └ div.inner-container[.small][.messages][.has-unread][.hosting][.inactive]
      [tabindex="2"] [aria-label="Cruiser Selected"]
    └ div.marker-avatar
      └ div[data-testid="cv-marker-avatar-image"].marker-avatar-image
          style="background-image:url('https://profile.sniffiesassets.com/<id>/<blob>-profile-pic-thumb.jpeg')"
        └ div[data-testid="cv-marker-sprite-image"].sfw-sprite[hidden]
      ├ div[data-testid="inactiveOverlay"].inactive-overlay          (optional)
      └ marker-icon-grid
        ├ div[data-testid="onlineStatus"].online-status              grid-area 1/1
        ├ div[data-testid="userMarkerHostingContainer"].bottom-center-container
        │   > span.pill-item > i.fa.fa-video.hosting-status[data-testid="hostingAvatarIcon"]
        ├ span.title-tag.badge-icon                                  grid-area 2/3
        │ ├ i.fa.sniffiesIcon.sniffiesIcon-verified   |  i.fa.fa-user-circle
        │ └ app-sexual-position-icon[data-testid="sexualPositionIcon"]
        │   └ div.position-emoji-icon[.has-message]
        │     ├ img.emoji-image[data-testid="top-icon"|"bottom-icon"] alt="top"|"bottom"
        │     │    src=…/eggplant.webp | …/peach.webp
        │     └ svg.emoji-icon.vers-top[data-testid="vers-top-icon"]  (optional modifier)
        └ div[data-testid="avatarOngoingMsgIcon"].conversation-marker.floating[.messaged|.unread]
          └ div.relative-container
            ├ span[data-testid="avatarNewMsgIcon"].unread-count  →  "2"
            ├ i[data-testid="avatarSeenIcon"].fa.fa-check-circle
            └ i[data-testid="avatarReplyIcon"].fa.fa-reply
```

Source: `SNAP` offsets ~ marker-user block; counts: 200 `markerUserContainer`, 201
`sexualPositionIcon`, 200 `top-icon` vs 1 `bottom-icon`, 74 `vers-top-icon`, 85 `inactiveOverlay`,
83 `hostingAvatarIcon`, 24 `onlineStatus`, 95 `avatarOngoingMsgIcon`, 22 `avatarReplyIcon`,
12 `avatarSeenIcon`, 3 `avatarNewMsgIcon`. **OBSERVED**

`marker-level-<N>` observed values: 0,1,2,4,5,6,7,10 — a z/cluster tier. Level 10 is the
current-visitor marker in this snapshot. OBSERVED / role INFERRED.

### 4.2 Current-visitor (self) marker

Different subtree, same map layer:

```
div.maplibregl-marker.marker-level-10
└ div.current-visitor-marker-container
  └ app-marker-current-visitor-content
    └ div[data-testid="cv-marker-container"].marker-container.current-visitor
        id="<self profile id>"
      └ div[data-testid="userAvatar"].inner-container.hosting
          id="<self profile id>-container"  aria-label="Your Profile Selected"
        └ … marker-avatar / marker-icon-grid (as above)
           + div[data-testid="currentVisitorMarkerHostingContainer"] > i.fa.fa-door-open
           + i[data-testid="avatarUserTypeIcon"].sniffiesIcon-verified
           + span.title-tag " You "
      ├ div.preview-tag.headline-preview > div.title-tag  →  headline text
      └ div.preview-tag.instructions-preview
```

Source: `SNAP` (`cv-marker-container` region). OBSERVED

### 4.3 Profile-ID recovery — the encoding scheme

`getMarkerIdFromElement(el)` tries, in order (`US:5538-5577`) — **OBSERVED**:

1. `el.closest("a[href*='/profile/']")` → `href.match(/\/profile\/([0-9a-f]{6,})/i)`
2. `el.closest("[data-profile-id],[data-user-id],[data-cruiser-id]")` → that attribute
   *(none of these three attributes exist in `SNAP` — this branch appears vestigial)*
3. `el.closest(".marker-avatar-image")` → **avatar background-image URL**:
   `bg.match(/profile\.sniffiesassets\.com\/([0-9a-f]{6,})\//i)` — `extractIdFromBg`, `US:5515-5521`
4. Walk `parentElement` up to `<body>`, applying (3) to each node's background-image
5. `el.closest(".marker-container").getAttribute("id")`
6. `el.closest(".maplibregl-marker").querySelector(".marker-container").getAttribute("id")`

**Two independent encodings therefore exist and agree:** the `id` attribute on
`.marker-container` **is** the 24-hex profile id, and the avatar CDN path's first segment is the
same id. `SNAP` confirms both (`id="660dee38d1ac42d4d0357a10"` alongside
`profile.sniffiesassets.com/6930ac77f5a006d40166f239/…`). OBSERVED

Fallback #7 — **MapLibre hit-test.** `tryIdFromMapForMarker` → `getIdFromMapAtPoint(x,y)` →
`map.queryRenderedFeatures([x,y])`, then mines each feature for `feature.id` or
`properties.{_id,id,userId,user_id,profileId,profile_id,cruiserId,cruiser_id}`, then *all* property
values, keeping the **longest** `[0-9a-f]{6,}` match. Throttled per-marker by `MAP_MARKER_RETRY_MS`
(10 s). `US:5892-5950`. OBSERVED (mechanism) / INFERRED (which property actually carries the id).

**Map instance discovery** (`findMap`, `US:5850-5891`) — probes `window.map`, `window._map`,
`window.__map`, `window.SNIFFIES.map`, `.mapInstance`, `.mapService.map`, `.mapService.mapInstance`;
verifies `c.getCanvas() === document.querySelector(".maplibregl-canvas")`; last resort brute-forces
every `window` property for a `{getCanvas, queryRenderedFeatures}` duck type. **None of these
globals appear in `SNAP`** — treat map-instance access as unreliable. OBSERVED (code) / INFERRED
(that it works).

### 4.4 Normalized id form

`normalizeProfileId(v)` = first run of `[0-9a-f]{6,}` anywhere in the stringified value, lowercased.
Deliberately **extraction, not validation** — so URLs and labels normalize cleanly, but a
non-ObjectId hex-looking substring can false-positive. `US:3028-3035`. OBSERVED

### 4.5 Attitude / position in marker DOM

Canonical source is the API (`§2`). DOM inference is the fallback (`inferAttitudeFromIcons`,
`US:6022-6050`), a 4-tier ladder — **OBSERVED**:

1. user-configured `iconRules` (text / className / bg / mask substring)
2. emoji regex on icon text/attrs: `PEACH_RE = /(peach|🍑)/i` → `bottom`;
   `EGGPLANT_RE = /(eggplant|🍆)/i` → `top` (`US:1594-1595`)
3. same regexes against `className + backgroundImage + maskImage`
4. same regexes against the marker's whole `textContent`

Candidates are `i, span, div, svg, img` descendants **plus** their `::before` / `::after` pseudos
(`content`, `background-image`, `mask-image` read via `getComputedStyle`). `US:5989-6018`. OBSERVED

`SNAP` shows the real encoding is cleaner than the heuristic: `img[alt="top"|"bottom"]` with
`src` = `eggplant.webp` / `peach.webp`, plus an optional sibling `svg[data-testid="vers-top-icon"]`
modifier for the "vers-" variants. A `vers-bottom` counterpart is not in this snapshot but is
strongly implied by the userscript's bucket list. OBSERVED / INFERRED.

**Canonical attitude buckets** (`normalizeAttitude`, `US:5580-5596`; `GLOBAL_CHAT_ATTITUDES`,
`US:6488-6491`): `bottom`, `vers-bottom`, `vers`, `vers-top`, `top`, `side`, `submissive-bottom`,
`power-bottom`, `passive-top`, `dom-top-breeder`, `unspecified`. Match order matters — compound
labels are tested before the generic `bottom`/`vers`/`top` fallbacks. OBSERVED

### 4.6 Online status in the DOM

`div[data-testid="onlineStatus"].online-status` exists (24 in `SNAP`, grid-area 1/1) but is an
**empty div** — state is carried entirely by CSS. The userscript **never reads it**; all online
filtering comes from the partials `connectUpdateTime`/`disconnectTime` feed. `SNAP` + `US` (no
selector hit). OBSERVED

Adjacent presence signals in DOM: `.inner-container.inactive` and
`div[data-testid="inactiveOverlay"]`. OBSERVED / semantics INFERRED.

### 4.7 Marker mutation observer

Re-scan is triggered on added nodes matching
`.maplibregl-marker, .marker-avatar-image, a[href*='/profile/']`, debounced 350 ms via
`scheduleMapRefresh`. `US:10797-10812,6663-6673`. OBSERVED

---

## 5. DOM: profile pane / cruiser cards

### 5.1 Open profile pane

`findProfileContainer()` (`US:8734-8785`) — a **pure heuristic cascade**, which is itself the
finding: no stable selector was ever established. OBSERVED (code) / INFERRED (that any of it
matches current markup).

1. `.his-profile` — if visible, pick the first descendant matching
   `div[style*="overflow"], [class*="content"], [class*="scroll"]` with `height > 100px` and
   `> 3` descendants; else first visible child > 100 px; else `.his-profile` itself
2. `[id="sniffies-infowindow"]` if visible
3. `[role="dialog"], .modal, [class*="panel"][class*="left"], [class*="panel"][class*="bottom"]`
   — first visible one (> 100×200 px) whose text contains `"m,"`, matches `/\d+,\s*\d+["']/`, or
   contains `"looking"`
4. Returns **`null`** (deliberately not `document.body`) so callers bail rather than injecting into `<body>`

Neither `.his-profile` nor `#sniffies-infowindow` appears in `SNAP` (profile pane closed).
NOT VERIFIED.

Current-profile id: `getCurrentProfileId()` = URL `/profile/<hex6+>` else the first
`a[href*='/profile/']` anchor's href. `US:8719-8731`. OBSERVED

Canonical profile URL: `https://sniffies.com/profile/<id>`; `getProfileUrlFromContainer` prefers a
real `a[href*="/profile/<id>"]` anchor and absolutizes it. `US:8853-8871`. OBSERVED

### 5.2 Cruiser-card carousel (bottom-of-map browse strip)

| Selector | Role | Source | Conf. |
|---|---|---|---|
| `section[data-testid="cruiserCardCarousel"].cruisers-carousel` | Carousel root | `SNAP` | OBSERVED |
| `header[data-testid="cruiserCardHeader"].carousel-header` | Header; carries class **`closed`** when collapsed. Clicking it toggles open. | `SNAP`; `US:7800-7803` | OBSERVED |
| `div.header-left > div.closed-users-stack[aria-label="Connected users preview"]` | Collapsed avatar stack | `SNAP` | OBSERVED |
| `app-cruiser-header-avatar > span.closed-user-avatar-shell > span[data-testid="cruiserCardClosedAvatar"].closed-user-avatar` | Collapsed avatar; **`id` = profile id**, `background-image` = profile CDN URL, `z-index` inline = stack order | `SNAP` | OBSERVED |
| `[data-testid="cruiserCard"]` | Expanded card; **`id` = profile id** | `US:7794,7823` | OBSERVED in `US`, **absent from `SNAP`** (carousel collapsed) |
| `.map-container.carousel-closed` | Map wrapper reflects carousel state | `SNAP` | OBSERVED |

Cards are destroyed by `*ngIf` while collapsed — `getCruiserCarouselIds()` is meaningless until
`ensureCruiserCarouselOpen()` clicks the header and waits **400 ms** for render.
`US:7789-7805`. OBSERVED

Carousel navigation (`navigateCarouselProfile`, `US:7811-7830`): open → read ids in DOM order →
index of `getChatContextProfileId()` → step ±1 with wraparound (falls back to first/last when the
current profile isn't in the strip) → **click the card** (preserving SPA routing/animation) with a
hard `location.assign('https://sniffies.com/profile/<id>')` fallback. OBSERVED

### 5.3 `userStats` heading

`[data-testid="userStats"]` — the comma-separated stat line, e.g.
`26m, 5'5", average, vers bottom, clean cut/ftm`. The script splits on commas, hyphenates internal
spaces, and returns the first token that normalizes into `GLOBAL_CHAT_ATTITUDES`.
`US:6492-6505,6534-6535`. OBSERVED in `US`; **absent from `SNAP`** (chat closed).

### 5.4 Other map chrome (`SNAP`)

| Selector | Role |
|---|---|
| `div[data-testid="mainMap"].map-main-content[.filters-on]` | Map viewport; `filters-on` reflects active site-side filters |
| `div[data-testid="mapFrameRoot"].map-frame`, `[data-testid="mapFrameNoticeTitle"]` | Overlay frame / notice |
| `[data-testid="mapLayersButton"]` (i.fa-layer-group), `[data-testid="crosshairsIcon"]`, `[data-testid="fullScreenMapIcon"]`, `[data-testid="travelModeIcon"]` (title "Enable Travel Mode"), `[data-testid="hideMeButton"]` (svg, title "Hide me"), `[data-testid="iconHolderRightTop"]`/`iconHolderRightBottom` | Map controls |
| `[data-testid="settingsButton"]`, `[data-testid="sniffiesNavBarLink"]`, `[data-testid="sniffiesAngleRightButton"]`, `[data-testid="contextMenuRedDotAlert"]` | Upper nav |
| `.maplibregl-canvas` | The MapLibre canvas (used for map-instance identity check) |

All OBSERVED.

---

## 6. DOM: chat UI

### 6.1 Global Chat

| Selector | Role | Source | Conf. |
|---|---|---|---|
| `[data-testid="global-chat-list-container"]` | The scrolling message list. MutationObserver target (`childList`, `subtree`). | `US:6580,6604` | OBSERVED in `US`, absent from `SNAP` |
| `[data-testid="globalChat-message"]` | One message. **Its `id` attribute IS the author's profile id.** | `US:6511-6548,6572,6596-6598` | OBSERVED in `US`, absent from `SNAP` |
| `el.parentElement` of a message | The per-message `<app-global-chat-user-container>` wrapper — **this is what you toggle to hide one message** | `US:6553-6562` | OBSERVED |
| `[data-testid="global-chat-message-container"]` | ⚠️ **TRAP.** This testid sits on the single shared list viewport wrapping the whole `*ngFor`, **not** on each message. Toggling a class here hid/showed the entire panel. Explicitly documented as a past bug. | `US:6553-6558` | OBSERVED |
| `[data-testid="userStats"]` inside a message | Author's stat line → attitude when the author is not on the map | `US:6534` | OBSERVED |
| `button[data-testid="globalChatIcon"].global-chat-nav` + `i[data-testid="globalChatNewMsgDot"]` | Lower-nav Global Chat entry ("Cruising Update") + unread dot | `SNAP` | OBSERVED |
| `a[href*='/global-chat'], a[href$='/global-chat/']` | Link used to open Global Chat without a hard navigation | `US:7654` | OBSERVED |
| `chat-global-messages-container` (string in bundle) | Likely component/class name | `main-ILPGQBXF.js` | INFERRED |

### 6.2 Chat list / conversations

- `button[data-testid="chatButtonIcon"][title="Chat List"] > i.fa.fa-comments.navicon` in
  `app-nav-lower-container > #lower-nav-zone > .bottom-menu > .nav.bottom` — `SNAP`. OBSERVED
- The script does **not** use that testid; `findChatsListToggle()` scores every visible
  `a, button, [role=button], [role=link]` on text/aria/title/class/href
  (`^(chats|messages|inbox)$` = +8/+10, `href` `/(chats|messages|inbox)/?$` = +12) and requires a
  score ≥ 6. `US:7683-7709`. OBSERVED
- Unread detection is likewise selector-agnostic — a badge-selector sweep over
  `[class*='unread' i]`, `[class*='new-message' i]`, `[class*='hasUnread' i]`,
  `[class*='has-unread' i]`, `[aria-label*='unread' i]`, `[data-testid*='unread' i]`, `[data-unread]`,
  then climbing to the nearest clickable ancestor
  (`a[href*='/profile/'], a[href*='/chat'], li, [role=button], [role=link], [class*='chat-item' i], [class*='conversation' i], [class*='thread' i], [class*='message-item' i]`).
  `US:7723-7755`. OBSERVED
- `SNAP` marker DOM does expose real unread state: `.inner-container.messages.has-unread` +
  `span[data-testid="avatarNewMsgIcon"].unread-count` (text = count). OBSERVED — **the script does
  not use this**, which is a cleaner signal than the class sweep.

### 6.3 Message list, composer, send

All three are **heuristic** — no stable selectors were established. OBSERVED (code) / NOT VERIFIED
(against live DOM).

| Function | Strategy | Source |
|---|---|---|
| `pickChatMessageContainer()` | Candidates: `[data-testid*='message-list'], [data-testid*='messages'], [class*='message-list'], [class*='messages-list'], [class*='chat-messages'], [class*='conversation-messages'], [class*='thread-messages']`; visible only; skip area < 20,000 px²; score = `area + min(6000, textLen*2) + min(3000, childCount*24)`; highest wins | `US:7187-7210` |
| `findChatInputElement()` | Candidates: `textarea, input[type='text'], [contenteditable='true']`; visible; not inside the script's own panels; score: `placeholder`/`aria-label` containing `message`/`chat` = +4 each, `TEXTAREA` or contenteditable = +2, sitting below 45 % of viewport height = +1 | `US:7019-7041` |
| `fillChatInput()` | contenteditable → set `textContent` + dispatch `InputEvent('input', {inputType:'insertText'})` (falls back to plain `Event('input')`); value-based → set `.value` + dispatch `input` **and** `change` | `US:7044-7069` |
| `clickChatSendButton()` | Scope to `inputEl.closest("form, [class*='chat'], [class*='message']")` else `document`; among visible `button, [role=button]`, match `textContent === "send"` or `aria-label`/`title` containing `send` | `US:7072-7087` |
| `pressEnterToSend()` | Fallback: dispatch `keydown` + `keypress` + `keyup` with `key/code = "Enter"`, bubbling & cancelable | `US:7090-7102` |
| `closeCurrentProfileChatWindow()` | Click first visible `button/[role=button]/a` whose text+aria+title+class matches `/(close\|dismiss\|collapse\|exit\|back)/`, skipping the script's own panels; else `history.back()` on a `/profile/<hex>(/chat)?` path | `US:7401-7432` |
| `forceRefreshCurrentChatView()` | Click a control matching `/(refresh\|reload\|new messages\|check updates\|sync)/`, then refocus the composer and dispatch a window `focus` | `US:7249-7284` |

### 6.4 `.his-profile`

Used **only** in `findProfileContainer()` as the first-choice open-profile-pane root
(`US:8736`). Not present in `SNAP`. Semantics ("the other person's profile pane") are INFERRED
from naming and usage.

---

## 7. data-testid inventory

Legend: **S** = present in `SNAP` (count = occurrences); **U** = referenced by the userscript.

| data-testid | S | U | Where it appears | What `US` uses it for |
|---|---:|:--:|---|---|
| `markerUserContainer` | 200 | – | `.marker-container.user` on every peer marker | not used (script uses `.marker-container` / `.maplibregl-marker`) |
| `sexualPositionIcon` | 201 | – | `app-sexual-position-icon` in `marker-icon-grid` | not directly; icons swept generically |
| `cv-marker-avatar-image` | 201 | – | `.marker-avatar-image` (both peer **and** self markers, despite the `cv-` prefix) | not directly; script selects `.marker-avatar-image` |
| `cv-marker-sprite-image` | 201 | – | `.sfw-sprite` overlay (hidden; `background-image:url("null")` when unused) | – |
| `top-icon` | 200 | – | `img.emoji-image` `alt="top"` `src=eggplant.webp` | attitude → `top` (via emoji regex) |
| `bottom-icon` | 1 | – | `img.emoji-image` `alt="bottom"` `src=peach.webp` | attitude → `bottom` |
| `vers-top-icon` | 74 | – | `svg.emoji-icon.vers-top` modifier over the base emoji | – (bucket exists in `normalizeAttitude`) |
| `avatarOngoingMsgIcon` | 95 | – | `.conversation-marker.floating[.messaged\|.unread]` | – |
| `inactiveOverlay` | 85 | – | `.inactive-overlay` on the avatar | – |
| `userMarkerHostingContainer` | 83 | – | `.bottom-center-container` (hosting pill) | – |
| `hostingAvatarIcon` | 83 | – | `i.fa.fa-video.hosting-status` | – |
| `onlineStatus` | 24 | – | empty `div.online-status`, grid-area 1/1 | – (presence comes from the API) |
| `avatarReplyIcon` | 22 | – | `i.fa.fa-reply` | – |
| `avatarSeenIcon` | 12 | – | `i.fa.fa-check-circle` | – |
| `cruiserCardClosedAvatar` | 3 | – | `span.closed-user-avatar`, `id` = profile id | – |
| `avatarNewMsgIcon` | 3 | – | `span.unread-count`, text = unread count | – |
| `settingsButton` | 2 | – | upper-nav button + its `<i>` | – |
| `imageViewerClose` | 2 | – | `app-image-viewer` | – |
| `userAvatar` | 1 | – | self marker `.inner-container.hosting`, `aria-label="Your Profile Selected"` | – |
| `travelModeIcon` | 1 | – | `.lower-map-icon.travel-on-map`, title "Enable Travel Mode" | – |
| `sniffiesNavBarLink` | 1 | – | nav logo `<i>` | – |
| `sniffiesAngleRightButton` | 1 | – | nav chevron | – |
| `mapLayersButton` | 1 | – | `i.fa.fa-layer-group` | – |
| `mapFrameRoot` / `mapFrameNoticeTitle` | 1 / 1 | – | `app-map-frame` overlay | – |
| `mainMap` | 1 | – | `.map-main-content[.filters-on]` | – |
| `lowerNavShopIcon` | 1 | – | `.shop-nav` | – |
| `imageViewerScrollLeft` / `imageViewerScrollRight` | 1 / 1 | – | image viewer paging | – |
| `iconHolderRightTop` / `iconHolderRightBottom` | 1 / 1 | – | map control clusters | – |
| `hideMeButton` | 1 | – | `svg.clickable` inside `.lower-map-icon.hide-on-map` | – |
| `globalChatNewMsgDot` | 1 | – | `i.fa.fa-circle.bright.sub-icon` | – |
| `globalChatIcon` | 1 | – | `button.global-chat-nav` (title "Cruising Update") | – (script finds the `<a href*=/global-chat>` instead) |
| `fullScreenMapIcon` | 1 | – | map control | – |
| `cv-marker-container` | 1 | – | self `.marker-container.current-visitor` | – |
| `currentVisitorMarkerHostingContainer` | 1 | – | self hosting pill (`fa-door-open`) | – |
| `cruiserCardToggleIconUp` | 1 | – | carousel expand chevron | – |
| `cruiserCardHeader` | 1 | ✔ | `header.carousel-header[.closed]` | detect collapsed state; **click to expand** (`US:7800-7803`) |
| `cruiserCardCarousel` | 1 | – | `section.cruisers-carousel` | – |
| `crosshairsIcon` | 1 | – | recenter control | – |
| `contextMenuRedDotAlert` | 1 | – | nav alert dot | – |
| `chatButtonIcon` | 1 | – | lower-nav Chat List button | – (script scores generically) |
| `avatarUserTypeIcon` | 1 | – | self verified badge | – |
| `dev-stats-modal`, `initial-hash`, `fetched-hash`, `download-status`, `bundle-id`, `websocket-connected`, `close-button` | 0 | – | Dev-stats modal, compiled into `main-ILPGQBXF.js` but not rendered in `SNAP` | – (**`websocket-connected` is a live WS-status probe worth using**) |
| `cruiserCard` | 0 | ✔ | expanded carousel card; `id` = profile id | enumerate carousel ids; click to navigate (`US:7794,7823`) |
| `globalChat-message` | 0 | ✔ | one global-chat message; `id` = author profile id | hide/block author; middle-click target (`US:6511-6598`) |
| `global-chat-list-container` | 0 | ✔ | global-chat scroll list | MutationObserver root (`US:6580`) |
| `global-chat-message-container` | 0 | ⚠ | **shared list viewport, one per list** | documented trap — never toggle here (`US:6553-6558`) |
| `userStats` | 0 | ✔ | profile/message stat line | parse attitude for off-map authors (`US:6534`) |
| `cv-marker` | 0 | ⚠ | **does not exist** | used in `resolveMarkerRoot`/click handlers (`US:5534,6901`) — the real ids are `cv-marker-container` / `cv-marker-avatar-image`. Dead selector. |

---

## 8. Auth / session model

| Fact | Source | Conf. |
|---|---|---|
| Both Sniffies API calls use `credentials: "include"` and **no** `Authorization` header | `US:6113,6159` | OBSERVED |
| The only `Authorization: Bearer` headers in the script are Google Drive sync, unrelated to Sniffies | `US:8552,8577,8631` | OBSERVED |
| No CSRF token, API key, signature, or custom header is sent — `content-type: application/json` is the sole header | `US:6111,6157` | OBSERVED |
| A first-party cookie `session_id` is set client-side at page load: `document.cookie = 'session_id=' + uuidv4() + ';path=/;domain=sniffies.com;SameSite=None;Secure'` and mirrored to `window.SNIFFIES.session_id` | `SNAP` offset ~9336 | OBSERVED |
| `SameSite=None; Secure` on that cookie means it is sent cross-site — consistent with a browser `fetch` to `usw.api.sniffies.com` carrying it under `credentials:"include"` | derived | INFERRED |
| The actual authentication cookie(s) (name, `HttpOnly` status, lifetime, refresh) are **not visible** — `session_id` is a client-generated correlation id, not a credential | derived | INFERRED |
| Practical implication: **any same-browser caller inherits the session.** A library needs no login flow, but also cannot authenticate outside the browser. | derived | INFERRED |
| `hcaptcha.html` (×2) + `captcha.sniffies.com` are in the snapshot's asset set — a challenge path exists somewhere in the flow | `SNAP _files/` | OBSERVED / trigger INFERRED |

---

## 9. Storage & config

### 9.1 `window.SNIFFIES` (site config)

| Key | Example value | Set where | Conf. |
|---|---|---|---|
| `session_id` | uuid v4 | inline `<head>` script | OBSERVED |
| `referrer` | `document.referrer` | inline `<head>` script | OBSERVED |
| `countryCode` | `"US"` | inline body script | OBSERVED |
| `regionCode` | `"GA"` | inline body script | OBSERVED |
| `appVersion` | `"27"` | inline body script | OBSERVED |
| `nativeAppVersion` | `"1.0.1"` | inline body script | OBSERVED |
| `cookieConfig` | large JSON (cookie-consent UI copy, per-language, per-vendor cookie descriptions) | inline body script | OBSERVED |
| `TRANSLATION` | full i18n bundle (`ADVERTISING`, `HOUSE_ADS`, `SHARED`, …) | separate inline script | OBSERVED |
| `ACCEPTED_LANGUAGE` | `"en-US"` | inline body script | OBSERVED |
| `map` / `mapInstance` / `mapService` | **probed by `US:5860-5863`, not present in `SNAP`** | — | NOT PRESENT |
| `currentUser` / `viewer` / `user` | **probed by `US:4992-4994`, not present in `SNAP`** | — | NOT PRESENT |

App shell markers: `<html lang="en">`, `<div id="sniffies" class="dark-mode platform-web is-upgraded landscape" lang="en-US">`,
`<body class="current-visitor-upgraded">`, `<app-root ng-version="21.2.12">`. `SNAP`. OBSERVED

### 9.2 Userscript storage keys

Arrays are **newest-first**: loaders read the first key that exists (forward migration); writers
always persist to index `[0]`. Never rewrite an old key in place — prepend a new version.
`US:230-263`. OBSERVED

| Family | Key(s) | Holds |
|---|---|---|
| State | `sniffiesSoftFilterState_v2`, `_v1`, `sniffiesSoftFilterState` | all filter toggles/settings |
| Blocked | `sniffiesSoftFilterBlocked_v2`, `_v1`, `sniffiesSoftFilterBlocked` | manual block set |
| Blocked meta | `sniffiesSoftFilterBlockedAt_v1`, `sniffiesSoftFilterTempBlockExpiresAt_v1` | block timestamps / temp-block expiry |
| Icon/attitude | `sniffiesSoftFilterIconRules_v2`, `_v1`, `sniffiesSoftFilterIconRules`; `sniffiesSoftFilterManualAtt_v1` | icon→attitude rules; manual overrides |
| API discovery | `sniffiesSoftFilterPartialsMode_v1`, `…PartialsBase_v1`, `…FullUserBase_v1` | learned endpoint shape/origins |
| Rate limiter | `sniffiesSoftFilterRate_v1` | request count + cooldown-until |
| Chat | `…ChatActivity_v1`, `…ChatSelfIds_v1`, `…ChatDeleteStats_v1`, `…ChatDeleteEvents_v1` | derived chat state |
| User data | `…Notes_v1`, `…Ratings_v1`, `…Bookmarks_v1`, `…Appointments_v1`, `…HowdySent_v1`, `…HideHistory_v1`, `…PhraseHistory_v1`, `…PhraseStats_v1` | bookmarks, notes, reminders, phrases |
| Panel geometry | `…PanelPos_v2`, `…MatchPanelPos_v1`, `…ApptPanelPos_v1`, `…BookmarkPanelPos_v1` | draggable panel positions |
| Cross-tab | `sniffiesSoftFilterPendingMessage_v1`, `sniffiesSoftFilterAutoMessageSignal_v1` | auto-message queue + `storage`-event signalling |
| Drive (GM storage, **not** localStorage) | `…GDriveToken_v1`, `…GDriveTokenMeta_v1`, `…GDriveFileId_v1`, `…GDriveSyncTime_v1`, `…GDriveSyncStatus_v1` | OAuth token kept out of page reach |

---

## 10. Behavioral gotchas

### 10.1 Rate-limit posture

| Constant | Value | Meaning | Source |
|---|---|---|---|
| `MAX_REQUESTS_PER_MIN` | **6** | Self-imposed budget against *all* Sniffies partials/full calls, per rolling minute. "The rate limiter is the only backpressure." | `US:172` |
| `COOLDOWN_MS` | **600,000** (10 min) | Tripped by any HTTP **429** | `US:173` |
| `SCAN_INTERVAL_MS` | 5,000 | Marker rescan cadence | `US:174` |
| `APPLY_INTERVAL_MS` | 2,000 | Hide/show decision-engine cadence (also the global-chat full-sweep backstop) | `US:175` |
| `FETCH_TIMEOUT_MS` | 15,000 | `AbortController` timeout on every outbound call; without it a stalled endpoint silently consumes budget forever | `US:6082-6097` |
| partials batch | 50 ids | one request per 50 ids | `US:6629` |
| full-user fetch | **1 profile per invocation** | deliberate spread | `US:6242-6244` |
| `CACHE_TTL_MS` / `UNKNOWN_TTL_MS` | 10 min / 2 min | attitude cache; unknown expires sooner | `US:176-177` |
| `PROFILE_TEXT_TTL_MS` / `_FULL_TTL_MS` / `_FULL_RETRY_MS` | 5 min / 45 min / 10 min | text cache by source, plus failure backoff | `US:178-182` |
| `MAP_MARKER_RETRY_MS` | 10,000 | per-marker cooldown on the costly `queryRenderedFeatures` hit-test | `US:183` |

All OBSERVED. A library must budget against the same shared ceiling — the script's assumption is
that it is the only extra client.

### 10.2 SES / lockdown constraints

- Sniffies ships a **hardened (frozen-intrinsics) startup**. The script **never injects a `<script>`
  into the page** and never reaches into the page realm beyond `unsafeWindow`.
  `US:82-83,5484`. OBSERVED
- `fetch` may be **shared and frozen** across the sandbox and page realms — hence the
  `__sniffiesChatWrapped` marker to avoid double-wrapping, and a `try/catch` that *logs* the failure
  so a blocked patch is distinguishable from a working one. `US:5322-5324,5360-5363`. OBSERVED
- `WebSocket` is wrapped by `Proxy` construct trap; if the constructor is already replaced or frozen,
  fall back to patching `WebSocket.prototype.dispatchEvent`. `US:5443-5475`. OBSERVED
- `NativeWebSocket.__sniffiesChatPatched = true` is itself wrapped in `try/catch` — the constructor
  may be non-extensible. `US:5455`. OBSERVED

### 10.3 Angular DOM traps

- **Never select on `_ngcontent-ng-cNNNN` / `_nghost-ng-cNNNN` / `ng-tns-cNNNN-N` hashes** — they are
  per-build. `SNAP` is dense with them (`_ngcontent-ng-c3428766355`, `ng-tns-c2139989556-0`, …).
  OBSERVED
- `ng-star-inserted` marks `*ngIf`/`*ngFor` output; `<!---->` anchor comments are everywhere. Nodes
  are **destroyed, not hidden** — e.g. `[data-testid="cruiserCard"]` does not exist while the
  carousel is collapsed. `SNAP`; `US:7790-7791`. OBSERVED
- Angular **replaces** container elements on navigation. `ensureGlobalChatHideObserver` re-checks
  `observer.__target === list && document.body.contains(list)` every cycle and reattaches.
  `US:6578-6606`. OBSERVED
- **Marker element identity is unstable.** `scanMarkers` can remap an id to a different node while
  the old node still carries the hide class, permanently sticking a marker hidden. Mitigation: strip
  `HIDE_CLASS` from *every* element carrying it and re-apply in the **same synchronous pass** (no
  repaint between, so no flicker). `US:6379-6382`. OBSERVED
- `[data-testid="global-chat-message-container"]` is the **list viewport**, not a per-message
  wrapper. Toggling a class there hid the entire global chat. Use `messageEl.parentElement`
  (`<app-global-chat-user-container>`). `US:6553-6558`. OBSERVED
- `[data-testid="cv-marker"]` is used by the script but **does not exist** in `SNAP`. Dead selector.
  `US:5534,6901` vs `SNAP`. OBSERVED

### 10.4 Correctness traps the script documents

| Trap | Mitigation | Source |
|---|---|---|
| Naïve key-suffix regex `at\|ts$` false-matched `seat`, `format`, `chat`, `stats`, `candidate` — a stray number became a timestamp | tightened to `(time\|date\|timestamp)$` or an explicit verb prefix + `at\|ts$` | `US:4780-4782` |
| Substring `/out/` / `/in/` on generic `type` fields flipped direction on `"shout"`, `"checkout"`, `"join"`, `"typing"` — corrupting the reply-detection test | direction strings matched **exactly**, and only on keys `direction`/`messagedirection` | `US:4747-4754` |
| A single misclassified frame could permanently shadow a real peer as "self" | self-ids are learned **only** from an explicit direction signal, never positional/context inference | `US:4863-4865` |
| Writing a direction-less "last activity" time into both my/their made `theirLast > myLast` unsatisfiable | direction-less times go into an `anyLastTs` channel only | `US:4836-4838,4891-4893` |
| Re-fetching chat history replayed old inbound messages and spuriously un-hid a blocked profile | strict `ts > blockedAt` gate | `US:4880-4885` |
| `JSON.stringify(obj)` for text matching let `"top"` hit **keys** like `hideTop`/`createdAt` | walk collects string **values** only (depth ≤ 6) | `US:5700-5706` |
| Running the generic BFS walker over partials/full re-attributed nested times to the wrong peer | those two URLs are excluded from `shouldInspectApiUrl` | `US:5233-5237` |
| Response body consumed twice (wrapped `fetch` + patched `Response.prototype.json`) | `__sniffiesChatSeen` marker on the clone/original | `US:5337-5341,5375-5382` |
| A ts-less deletion event replayed under a fresh `now()` inflated the deletion count | fingerprint uses a stable `"no-ts"` sentinel | `US:4945-4950` |
| A server "valid until" future timestamp read as currently-online | `computeLastActiveTs` clamps to `≤ now()` | `US:5170-5171` |
| Attitude key absent ≠ attitude falsy | `hasOwnProperty("attitude")` check | `US:6192-6193` |
| A later partials row shortened text already hydrated from a `full` fetch | keep the longer `full` text | `US:5793-5800` |

All OBSERVED.

### 10.5 Singleton guard

Attribute **`data-sniffies-soft-filter-active`** on `document.documentElement`, plus
`data-sniffies-soft-filter-started-at` (ISO). A second load reads the first attribute and returns
early. Value is `"userscript"` or `"chrome-extension:<id>"`. `US:152-165`; confirmed live in the
`SNAP` `<html>` tag. OBSERVED

### 10.6 Other

- `HIDE_CLASS = "sniffies-soft-hide"` (map markers) and `sniffies-gc-hide`
  (`display:none !important`, global-chat). `US:229,1591`. OBSERVED
- Sizes are guarded: WS frames > 1.5 MB and XHR text bodies > 1.5 MB are skipped;
  `localStorage` values > 8 MB skipped. `US:5255-5257,5417-5418,187`. OBSERVED
- Both `window` and `unsafeWindow` are patched; identical refs de-duped by a `Set`.
  `US:5489-5506`. OBSERVED
- `SNAP` shows 200 peer markers with `alt="top"` and exactly one with `alt="bottom"` (the viewer).
  That is the site's own filter state (`.map-main-content.filters-on`), not a representative sample —
  do not treat the snapshot's icon distribution as the population. `SNAP`. INFERRED
- `data-within-radius` and `data-distance-miles` sit **right on the marker container** in `SNAP`, but
  the userscript ignores them and instead digs distance out of API payloads with a `/distance/i`
  key regex. Free, exact, DOM-local data currently unused. `SNAP` vs `US:5731-5755`. OBSERVED

---

## Coverage gaps

Things a library would want that **neither source establishes**:

1. **WebSocket endpoint.** No URL, path (`/socket.io/`?), namespace, EIO/Socket.IO version, query
   params, or handshake. `connectWebSocket(location)` and `setMapServer(lng)` live in `main-*.js` but
   the concrete host list is in an uncaptured lazy chunk.
2. **WebSocket event names.** The script matches on *field-name patterns*, never event names — so the
   `42["<eventName>", …]` catalogue (message, typing, presence, join/leave, read receipts) is
   completely unknown.
3. **Real message/conversation schema.** Every field name in §3.2 is a *guess list*. Which of
   `createdAt` vs `sentAt`, `fromId` vs `senderId`, etc. is actually on the wire is unresolved.
4. **The accepted `/api/user/partials` request key.** The script probes four shapes and persists
   whichever works — the source never records which one the server accepts.
5. **HTTP response envelope.** Whether partials rows are bare or wrapped (`{data:[…]}`,
   `{results:[…]}`), pagination, error body shape, and status-code semantics beyond 429.
6. **The full `/api/user/full` and partials field set.** Only `_id`, `data.profile.extended.sexuality.attitude`,
   `connectUpdateTime`, `disconnectTime` are named. Headline, age, height, photos array, hosting flag,
   travel mode, verification, blocked/blocking relations, distance field name — all unknown.
7. **Send-a-message API.** The script sends messages by **driving the UI** (fill composer, click
   Send / press Enter). No message-send HTTP or socket call is documented anywhere.
8. **Auth credential.** The real session cookie's name, `HttpOnly` status, TTL and refresh path are
   invisible. `session_id` is a client-generated correlation id. No login/logout flow, no captcha
   trigger conditions.
9. **Rate limits as enforced by the server.** `MAX_REQUESTS_PER_MIN = 6` is a *self-imposed* guess.
   The server's actual limit, window, scope (per-IP? per-session? per-endpoint?) and 429 response
   body / `Retry-After` are unknown.
10. **Chat-pane, chat-list and message-row selectors.** All heuristic. The snapshot has chat closed,
    so `globalChat-message`, `global-chat-list-container`, `userStats`, `cruiserCard` are only ever
    seen through the userscript's assertions — never verified against markup.
11. **Profile-pane markup.** `.his-profile` and `#sniffies-infowindow` are unverified; the fallback
    chain's text heuristics (`"m,"`, `"looking"`) suggest neither reliably matched.
12. **`vers-bottom` / `side` / `power-bottom` / `dom-top-breeder` icon DOM.** Only `top`, `bottom`
    and the `vers-top` svg modifier appear in `SNAP`. The other buckets' DOM encoding is unconfirmed.
13. **`onlineStatus` semantics.** The element is empty; whether online/away/offline is a class, a CSS
    variable, or a pseudo-element is unresolved.
14. **Map data source.** Whether markers come from the WebSocket, an HTTP feed, or MapLibre vector
    tiles — and which feature property carries the profile id in `queryRenderedFeatures` — is
    unresolved. The map-instance globals the script probes do not exist in `SNAP`.
15. **Region shards.** Only `usw*` hosts are known. The longitude-based `setMapServer` implies
    others (`use`, `eu`, …) but none are named.
16. **Endpoints in §2.2.** Methods, request bodies and responses for
    `/api/global-message/flag-user-messages`, `/api/place/*`, `/api/user/flag`, `/api/softReload`,
    `/api/v2/soft-reload/update-rooms`, `/api/visitor/current/updatedTime` — paths only.
17. **Snapshot age.** `SNAP` is `ng-version="21.2.12"`, `appVersion="27"`, captured 2026‑06‑14; the
    userscript is v0.12.1 dated 2026‑08‑26. Two months of drift between the DOM reference and the
    behavioral reference — the testid deltas in §7 may reflect drift rather than snapshot state.
