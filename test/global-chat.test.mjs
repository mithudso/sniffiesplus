import { describe, it, expect, beforeEach } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();
const HOUR = 3_600_000;
const mkId = (n) => String(n).padStart(24, "0").replace(/[^0-9a-f]/g, "a");

// Mirrors the real site DOM: each message sits alone inside its own
// <app-global-chat-user-container> wrapper (the actual hide/show target -- see
// applyGlobalChatHidingToMessages). Note this wrapper is NOT the shared
// [data-testid="global-chat-message-container"] list viewport that wraps the whole *ngFor list.
function makeMsg(id, statsText = "") {
  const wrapper = document.createElement("app-global-chat-user-container");
  const el = document.createElement("div");
  el.setAttribute("data-testid", "globalChat-message");
  el.id = id;
  if (statsText) {
    const s = document.createElement("div");
    s.setAttribute("data-testid", "userStats");
    s.textContent = statsText;
    el.appendChild(s);
  }
  wrapper.appendChild(el);
  return el;
}

beforeEach(() => {
  S.__state.chatActivity.clear();
  S.__state.profileLastActive.clear();
  S.__state.attitudeCache.clear();
  S.__state.blocked.clear();
  Object.assign(S.__state.state, {
    enabled: true, hideRecentChats24h: false, hideAnyChats: false, showOnlyChats: false, hideNotOnline2h: false,
    hideBottom: false, hideVersBottom: false, hideSide: false, hideSubmissiveBottom: false, hidePowerBottom: false,
    hideVers: false, hideVersTop: false, hideTop: false, hidePassiveTop: false, hideDomTopBreeder: false, hideUnspecified: false,
  });
  document.querySelectorAll('app-global-chat-user-container, [data-testid="globalChat-message"]').forEach((e) => e.remove());
});

describe("parseGlobalChatAttitude (read position from the message header)", () => {
  it("extracts the position token, hyphenating spaced display values", () => {
    expect(S.parseGlobalChatAttitude("24m, 5'8\", 140lb, 8\", slim, bi, vers")).toBe("vers");
    expect(S.parseGlobalChatAttitude("26m, 5'5\", average, vers bottom, clean cut/ftm")).toBe("vers-bottom");
    expect(S.parseGlobalChatAttitude("25m, 7\", bi, top")).toBe("top");
    expect(S.parseGlobalChatAttitude("29m, muscular, bicurious, vers top, masc/jock")).toBe("vers-top");
  });
  it("returns null for headers with no position", () => {
    expect(S.parseGlobalChatAttitude("30m, slim, bi")).toBe(null);
    expect(S.parseGlobalChatAttitude("")).toBe(null);
  });
});

describe("globalChatMessageHidden (author would be hidden on the map)", () => {
  it("hides a blocked author (by id)", () => {
    const p = mkId(1); S.__state.blocked.add(p);
    expect(S.globalChatMessageHidden(makeMsg(p))).toBe(true);
  });
  it("hides via the 2h-offline filter (by id)", () => {
    const p = mkId(2); S.__state.state.hideNotOnline2h = true;
    S.recordProfileLastActive(p, S.now() - 3 * HOUR);
    expect(S.globalChatMessageHidden(makeMsg(p))).toBe(true);
  });
  it("hides via attitude parsed from the message header", () => {
    const p = mkId(3); S.__state.state.hideTop = true;
    expect(S.globalChatMessageHidden(makeMsg(p, "25m, 7\", bi, top"))).toBe(true);
  });
  it("prefers the cached attitude when the author is on the map", () => {
    const p = mkId(6); S.__state.state.hideVersBottom = true;
    S.__state.attitudeCache.set(p, { attitude: "vers-bottom", ts: S.now() });
    expect(S.globalChatMessageHidden(makeMsg(p, "30m, top"))).toBe(true); // cache wins over header
  });
  it("does not hide an unfiltered author", () => {
    expect(S.globalChatMessageHidden(makeMsg(mkId(4), "30m, vers"))).toBe(false);
  });
  it("never hides when the master switch is off", () => {
    const p = mkId(5); S.__state.blocked.add(p); S.__state.state.enabled = false;
    expect(S.globalChatMessageHidden(makeMsg(p))).toBe(false);
  });
  it("ignores messages whose id isn't a profile id (place/system rows)", () => {
    expect(S.globalChatMessageHidden(makeMsg("system-banner"))).toBe(false);
  });
});

describe("applyGlobalChatHiding (DOM sweep)", () => {
  it("toggles the hide class by author and reverses when the filter clears", () => {
    const blockedP = mkId(10), okP = mkId(11);
    S.__state.blocked.add(blockedP);
    const a = makeMsg(blockedP, "vers"), b = makeMsg(okP, "vers");
    document.body.append(a.parentElement, b.parentElement);
    S.applyGlobalChatHiding();
    expect(a.parentElement.classList.contains("sniffies-gc-hide")).toBe(true);
    expect(b.parentElement.classList.contains("sniffies-gc-hide")).toBe(false);
    S.__state.blocked.delete(blockedP);
    S.applyGlobalChatHiding();
    expect(a.parentElement.classList.contains("sniffies-gc-hide")).toBe(false);
  });
});

describe("getGlobalChatMessageIdFromElement (resolve author id for a middle-click target)", () => {
  it("reads the id off the enclosing globalChat-message element, even from a nested child", () => {
    const p = mkId(20);
    const msg = makeMsg(p, "30m, vers");
    const child = document.createElement("span");
    msg.appendChild(child);
    document.body.append(msg.parentElement);
    expect(S.getGlobalChatMessageIdFromElement(child)).toBe(p);
  });
  it("returns null when the target isn't inside a globalChat-message element", () => {
    const stray = document.createElement("div");
    document.body.append(stray);
    expect(S.getGlobalChatMessageIdFromElement(stray)).toBe(null);
    expect(S.getGlobalChatMessageIdFromElement(null)).toBe(null);
  });
});

describe("handleMiddleMark on the Global Chat route (middle-click blocks the author)", () => {
  // hideProfileNow()'s saveBlockedSet() reassigns the module's `blocked` binding to a fresh Set on
  // every call (re-normalizing ids), so the harness's S.__state.blocked (a one-time snapshot at boot)
  // goes stale after the first block in a file. Assert the real user-facing effect instead — the
  // message gets hidden in Global Chat — which reads the live `blocked` internally and so is immune.
  const fakeEvent = (target) => ({
    type: "mousedown", button: 1, target,
    preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {},
  });
  const isHiddenInGlobalChat = (msg) => {
    S.applyGlobalChatHiding();
    return msg.parentElement.classList.contains("sniffies-gc-hide");
  };

  beforeEach(() => { history.pushState({}, "", "/global-chat"); });

  it("blocks the message author instead of falling into the chat-window auto-intro path", () => {
    const p = mkId(21);
    const msg = makeMsg(p, "30m, vers");
    document.body.append(msg.parentElement);
    S.handleMiddleMark(fakeEvent(msg));
    expect(isHiddenInGlobalChat(msg)).toBe(true);
  });
  it("resolves through a nested click target (e.g. the message text or avatar)", () => {
    const p = mkId(22);
    const msg = makeMsg(p, "30m, vers");
    const child = document.createElement("span");
    msg.appendChild(child);
    document.body.append(msg.parentElement);
    S.handleMiddleMark(fakeEvent(child));
    expect(isHiddenInGlobalChat(msg)).toBe(true);
  });
  it("is a no-op (not a re-block error) on a second middle-click of an already-blocked author", () => {
    const p = mkId(23);
    const msg = makeMsg(p, "30m, vers");
    document.body.append(msg.parentElement);
    S.handleMiddleMark(fakeEvent(msg));
    expect(() => S.handleMiddleMark(fakeEvent(msg))).not.toThrow();
    expect(isHiddenInGlobalChat(msg)).toBe(true);
  });
  it("ignores clicks outside any globalChat-message element (falls through to marker/chat handling)", () => {
    const stray = document.createElement("div");
    document.body.append(stray);
    expect(() => S.handleMiddleMark(fakeEvent(stray))).not.toThrow();
  });
});
