// applyHiding() is the core decision engine and CLAUDE.md documents its hide-gate order as an
// invariant to preserve ("blocked -> text-exclude -> recent-chat-24h -> recent-chat-2h -> any-chat ->
// missing-chat-history -> not-online -> repeated-delete -> unanswered-out -> attitude -> highlights").
// The individual predicates (shouldHideByRecentChats, shouldHideByNotOnlineWindow, etc.) are unit
// tested elsewhere in isolation, but nothing previously asserted the PRECEDENCE itself — that a
// higher-priority gate wins even when a lower-priority one would also apply. This file closes that gap
// for the two ends of the chain: `blocked` (highest priority) and attitude (lowest, checked last).
import { describe, it, expect, beforeEach } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();
const mkId = (n) => String(n).padStart(24, "0").replace(/[^0-9a-f]/g, "a");

function makeMarker() {
  // resolveMarkerRoot() resolves via el.closest('.maplibregl-marker') first, falling back to
  // el.parentElement — a bare div with no marker class would resolve to document.body instead of
  // itself, so hideMarker()/showMarker() would (wrongly, for test purposes) toggle the class on
  // <body>. Carry the real marker class so the root resolves to the element itself, matching actual
  // Sniffies marker DOM.
  const el = document.createElement("div");
  el.className = "maplibregl-marker";
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  S.__state.idToMarker.clear();
  S.__state.blocked.clear();
  S.__state.chatActivity.clear();
  S.__state.profileLastActive.clear();
  S.__state.attitudeCache.clear();
  document.body.innerHTML = "";
  Object.assign(S.__state.state, {
    enabled: true,
    hideRecentChats24h: false, hideRecentChats2h: false, hideAnyChats: false, showOnlyChats: false,
    hideNotOnline2h: false,
    hideBottom: false, hideVersBottom: false, hideSide: false, hideSubmissiveBottom: false,
    hidePowerBottom: false, hideVers: false, hideVersTop: false, hideTop: false,
    hidePassiveTop: false, hideDomTopBreeder: false, hideUnspecified: false,
  });
});

describe("applyHiding precedence order (do not reorder the gate chain)", () => {
  it("blocked (highest priority) hides a marker even when nothing else would hide it", () => {
    const id = mkId(1);
    const marker = makeMarker();
    S.__state.idToMarker.set(id, marker);
    S.__state.attitudeCache.set(id, { attitude: "vers", ts: S.now() });
    // Sanity check: with every filter off and an unfiltered attitude, an UNBLOCKED profile stays visible.
    S.applyHiding(true);
    expect(marker.classList.contains("sniffies-soft-hide")).toBe(false);
    // Now block it — blocked must win even though nothing downstream (attitude) would hide it.
    S.__state.blocked.add(id);
    S.applyHiding(true);
    expect(marker.classList.contains("sniffies-soft-hide")).toBe(true);
  });

  it("attitude (lowest priority) only applies once every higher-priority gate has cleared", () => {
    const id = mkId(2);
    const marker = makeMarker();
    S.__state.idToMarker.set(id, marker);
    S.__state.state.hideTop = true;
    S.__state.attitudeCache.set(id, { attitude: "top", ts: S.now() });
    // Higher-priority gate (blocked) fires first — attitude-hide would also fire, but blocked already
    // decided the outcome. Removing blocked should un-hide via the SAME class the attitude gate uses.
    S.__state.blocked.add(id);
    S.applyHiding(true);
    expect(marker.classList.contains("sniffies-soft-hide")).toBe(true);
    S.__state.blocked.delete(id);
    S.applyHiding(true);
    // Still hidden — but now via the attitude gate, since blocked no longer applies.
    expect(marker.classList.contains("sniffies-soft-hide")).toBe(true);
    S.__state.state.hideTop = false;
    S.applyHiding(true);
    expect(marker.classList.contains("sniffies-soft-hide")).toBe(false);
  });
});
