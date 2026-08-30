import { describe, it, expect, beforeEach, vi } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();
const mkId = (n) => String(n).padStart(24, "0").replace(/[^0-9a-f]/g, "a");

// The mobile long-press fallback (600ms, movement-cancelled) feeds handleMiddleMark a synthetic
// middle-click, so hiding works on devices with no middle button. It only arms on coarse-pointer
// devices — stubbed here via matchMedia.
function stubCoarsePointer(matches) {
  window.matchMedia = () => ({ matches });
}

function makeGlobalChatMessage(id) {
  const msg = document.createElement("div");
  msg.setAttribute("data-testid", "globalChat-message");
  msg.id = id;
  document.body.append(msg);
  return msg;
}

const touchDown = (target, x = 10, y = 10) => ({ pointerType: "touch", target, clientX: x, clientY: y });

beforeEach(() => {
  document.body.innerHTML = "";
  S.__state.blocked.clear();
  S.cancelLongPress();
  stubCoarsePointer(true);
  history.pushState({}, "", "/global-chat");
});

describe("isTempBlockModifier (Cmd on macOS, Ctrl on Windows/Linux)", () => {
  it("accepts metaKey or ctrlKey, rejects neither/null", () => {
    expect(S.isTempBlockModifier({ metaKey: true, ctrlKey: false })).toBe(true);
    expect(S.isTempBlockModifier({ metaKey: false, ctrlKey: true })).toBe(true);
    expect(S.isTempBlockModifier({ metaKey: false, ctrlKey: false })).toBe(false);
    expect(S.isTempBlockModifier(null)).toBe(false);
  });
});

describe("long-press = middle-click on touch devices", () => {
  it("blocks a Global Chat author after the 600ms hold", () => {
    const p = mkId(1);
    const msg = makeGlobalChatMessage(p);
    S.handleLongPressPointerDown(touchDown(msg));
    expect(S.__state.blocked.has(p)).toBe(false); // not before the hold elapses
    vi.advanceTimersByTime(600);
    expect(S.__state.blocked.has(p)).toBe(true);
  });

  it("a finger drag past the tolerance cancels the press", () => {
    const p = mkId(2);
    const msg = makeGlobalChatMessage(p);
    S.handleLongPressPointerDown(touchDown(msg, 10, 10));
    S.handleLongPressPointerMove({ clientX: 40, clientY: 10 });
    vi.advanceTimersByTime(1000);
    expect(S.__state.blocked.has(p)).toBe(false);
  });

  it("lifting the finger early cancels the press", () => {
    const p = mkId(3);
    const msg = makeGlobalChatMessage(p);
    S.handleLongPressPointerDown(touchDown(msg));
    vi.advanceTimersByTime(300);
    S.handleLongPressEnd();
    vi.advanceTimersByTime(1000);
    expect(S.__state.blocked.has(p)).toBe(false);
  });

  it("never arms on fine-pointer (desktop) devices or non-touch pointers", () => {
    const p = mkId(4);
    const msg = makeGlobalChatMessage(p);
    stubCoarsePointer(false);
    S.handleLongPressPointerDown(touchDown(msg));
    vi.advanceTimersByTime(1000);
    expect(S.__state.blocked.has(p)).toBe(false);
    stubCoarsePointer(true);
    S.handleLongPressPointerDown({ pointerType: "mouse", target: msg, clientX: 1, clientY: 1 });
    vi.advanceTimersByTime(1000);
    expect(S.__state.blocked.has(p)).toBe(false);
  });

  it("never arms over the script's own panels or non-actable targets", () => {
    const p = mkId(5);
    const panel = document.createElement("div");
    panel.className = "sniffies-bookmarks-panel";
    const inner = document.createElement("div");
    inner.setAttribute("data-testid", "globalChat-message");
    inner.id = p;
    panel.append(inner);
    document.body.append(panel);
    S.handleLongPressPointerDown(touchDown(inner));
    vi.advanceTimersByTime(1000);
    expect(S.__state.blocked.has(p)).toBe(false);
  });

  it("swallows the Android long-press contextmenu only within the 700ms window", () => {
    const p = mkId(6);
    const msg = makeGlobalChatMessage(p);
    S.handleLongPressPointerDown(touchDown(msg));
    vi.advanceTimersByTime(600);
    expect(S.__state.blocked.has(p)).toBe(true);
    const swallowed = { prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {}, stopImmediatePropagation() {} };
    S.handleLongPressContextMenu(swallowed);
    expect(swallowed.prevented).toBe(true);
    // A later, unrelated contextmenu is never eaten.
    const later = { prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {}, stopImmediatePropagation() {} };
    vi.advanceTimersByTime(2000);
    S.handleLongPressContextMenu(later);
    expect(later.prevented).toBe(false);
  });

  it("the 700ms bound holds with NO intervening swallow (the window expires on its own)", () => {
    const p = mkId(7);
    const msg = makeGlobalChatMessage(p);
    S.handleLongPressPointerDown(touchDown(msg));
    vi.advanceTimersByTime(600);
    expect(S.__state.blocked.has(p)).toBe(true);
    // First follow-through event arrives only after the window has expired: not eaten.
    vi.advanceTimersByTime(800);
    const late = { prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {}, stopImmediatePropagation() {} };
    S.handleLongPressContextMenu(late);
    expect(late.prevented).toBe(false);
  });

  it("swallows the iOS finger-lift click inside the pressed element, not elsewhere", () => {
    const p = mkId(8);
    const msg = makeGlobalChatMessage(p);
    const inner = document.createElement("span");
    msg.append(inner);
    S.handleLongPressPointerDown(touchDown(msg));
    vi.advanceTimersByTime(600);
    expect(S.__state.blocked.has(p)).toBe(true);
    // Click landing inside the pressed message: eaten (would otherwise open the hidden profile).
    const inside = { prevented: false, target: inner, preventDefault() { this.prevented = true; }, stopPropagation() {}, stopImmediatePropagation() {} };
    S.handleLongPressClick(inside);
    expect(inside.prevented).toBe(true);
    // Click elsewhere in the same window: untouched.
    const elsewhere = document.createElement("div");
    document.body.append(elsewhere);
    const outside = { prevented: false, target: elsewhere, preventDefault() { this.prevented = true; }, stopPropagation() {}, stopImmediatePropagation() {} };
    S.handleLongPressClick(outside);
    expect(outside.prevented).toBe(false);
  });
});
