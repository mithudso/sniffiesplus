import { describe, it, expect, beforeEach } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();
// Feature gate: carousel hotkeys shipped in v0.12.0 — skip (not fail) on older source variants.
const HAS_CAROUSEL = typeof S.getCruiserCarouselIds === "function";
const describeIf = describe.skipIf(!HAS_CAROUSEL);
const mkId = (n) => String(n).padStart(24, "0").replace(/[^0-9a-f]/g, "a");

// Flush pending microtasks (Promise resolutions) without needing to advance fake timers -- safe
// here because ensureCruiserCarouselOpen() takes the no-setTimeout path whenever no
// cruiserCardHeader element is present (see below), which is how every test in this file sets up.
const flush = () => Promise.resolve().then(() => Promise.resolve());

function makeCard(id) {
  const el = document.createElement("button");
  el.setAttribute("data-testid", "cruiserCard");
  el.id = id;
  return el;
}

beforeEach(() => {
  document.body.innerHTML = "";
  history.pushState({}, "", "/");
});

describeIf("getCruiserCarouselIds", () => {
  it("reads ids in DOM order", () => {
    const [a, b, c] = [mkId(1), mkId(2), mkId(3)];
    document.body.append(makeCard(a), makeCard(b), makeCard(c));
    expect(S.getCruiserCarouselIds()).toEqual([a, b, c]);
  });
  it("is empty when no cards are rendered (carousel collapsed)", () => {
    expect(S.getCruiserCarouselIds()).toEqual([]);
  });
});

describeIf("navigateCarouselProfile (steps through the browse carousel)", () => {
  it("clicks the next card relative to the currently open profile", async () => {
    const [a, b, c] = [mkId(10), mkId(11), mkId(12)];
    const cardA = makeCard(a), cardB = makeCard(b), cardC = makeCard(c);
    document.body.append(cardA, cardB, cardC);
    history.pushState({}, "", `/profile/${a}`);
    let clicked = null;
    cardB.addEventListener("click", () => { clicked = b; });
    await S.navigateCarouselProfile(1);
    expect(clicked).toBe(b);
  });
  it("clicks the previous card, wrapping from the first to the last", async () => {
    const [a, b, c] = [mkId(20), mkId(21), mkId(22)];
    const cardA = makeCard(a), cardB = makeCard(b), cardC = makeCard(c);
    document.body.append(cardA, cardB, cardC);
    history.pushState({}, "", `/profile/${a}`);
    let clicked = null;
    cardC.addEventListener("click", () => { clicked = c; });
    await S.navigateCarouselProfile(-1);
    expect(clicked).toBe(c);
  });
  it("wraps forward from the last card back to the first", async () => {
    const [a, b, c] = [mkId(30), mkId(31), mkId(32)];
    const cardA = makeCard(a), cardB = makeCard(b), cardC = makeCard(c);
    document.body.append(cardA, cardB, cardC);
    history.pushState({}, "", `/profile/${c}`);
    let clicked = null;
    cardA.addEventListener("click", () => { clicked = a; });
    await S.navigateCarouselProfile(1);
    expect(clicked).toBe(a);
  });
  it("starts from the first card on ArrowRight when no profile is open, or the current one isn't in the carousel", async () => {
    const [a, b] = [mkId(40), mkId(41)];
    const cardA = makeCard(a), cardB = makeCard(b);
    document.body.append(cardA, cardB);
    history.pushState({}, "", "/"); // no profile open
    let clicked = null;
    cardA.addEventListener("click", () => { clicked = a; });
    await S.navigateCarouselProfile(1);
    expect(clicked).toBe(a);
  });
  it("starts from the last card on ArrowLeft under the same condition", async () => {
    const [a, b] = [mkId(42), mkId(43)];
    const cardA = makeCard(a), cardB = makeCard(b);
    document.body.append(cardA, cardB);
    history.pushState({}, "", "/");
    let clicked = null;
    cardB.addEventListener("click", () => { clicked = b; });
    await S.navigateCarouselProfile(-1);
    expect(clicked).toBe(b);
  });
  it("is a no-op (no throw) when the carousel has no cards", async () => {
    await expect(S.navigateCarouselProfile(1)).resolves.toBe(false);
  });
});

describeIf("handleNavigationHotkeys: ArrowRight/ArrowLeft/f carousel-browse routing", () => {
  const arrowEvent = (key, overrides = {}) => ({
    key, repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false,
    target: document.body, defaultPrevented: false,
    preventDefault() {}, stopPropagation() {},
    ...overrides,
  });

  it("ArrowRight off a chat route steps to the next carousel profile", async () => {
    const [a, b] = [mkId(50), mkId(51)];
    const cardA = makeCard(a), cardB = makeCard(b);
    document.body.append(cardA, cardB);
    history.pushState({}, "", `/profile/${a}`);
    let clicked = null;
    cardB.addEventListener("click", () => { clicked = b; });
    S.handleNavigationHotkeys(arrowEvent("ArrowRight"));
    await flush();
    expect(clicked).toBe(b);
  });
  it("ignores ArrowRight while a chat is open (isChatRoute true)", async () => {
    const [a, b] = [mkId(52), mkId(53)];
    const cardA = makeCard(a), cardB = makeCard(b);
    document.body.append(cardA, cardB);
    history.pushState({}, "", `/profile/${a}/chat`);
    let clicked = false;
    cardB.addEventListener("click", () => { clicked = true; });
    S.handleNavigationHotkeys(arrowEvent("ArrowRight"));
    await flush();
    expect(clicked).toBe(false);
  });
  it("ignores ArrowRight/ArrowLeft while a modifier key is held", async () => {
    const [a, b] = [mkId(54), mkId(55)];
    const cardA = makeCard(a), cardB = makeCard(b);
    document.body.append(cardA, cardB);
    history.pushState({}, "", `/profile/${a}`);
    let clicked = false;
    cardB.addEventListener("click", () => { clicked = true; });
    S.handleNavigationHotkeys(arrowEvent("ArrowRight", { shiftKey: true }));
    await flush();
    expect(clicked).toBe(false);
  });
  it("ignores ArrowRight/ArrowLeft/f while typing in an input", () => {
    const input = document.createElement("input");
    document.body.append(input);
    history.pushState({}, "", "/");
    expect(() => S.handleNavigationHotkeys(arrowEvent("ArrowRight", { target: input }))).not.toThrow();
    expect(() => S.handleNavigationHotkeys(arrowEvent("f", { target: input }))).not.toThrow();
  });
});
