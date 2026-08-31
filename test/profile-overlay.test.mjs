import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();
// Feature gate: overlay-aware profile widgets + occluded-badge hiding shipped in v0.14.1.
const HAS_OVERLAY = typeof S.adjustProfileWidgetsForOverlay === "function";
const describeIf = describe.skipIf(!HAS_OVERLAY);

// jsdom implements neither layout nor document.elementFromPoint; each test stubs both.
const rect = ({ left = 0, top = 0, width = 0, height = 0 } = {}) => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top
});
const setRect = (el, r) => { el.getBoundingClientRect = () => rect(r); };
// Model real layout for the notes bar: its box moves down by whatever inline margin-top is applied.
const setFlowRect = (el, r) => {
  el.getBoundingClientRect = () => rect({ ...r, top: r.top + (parseFloat(el.style.marginTop) || 0) });
};

let origEFP;
beforeEach(() => {
  origEFP = document.elementFromPoint;
});
afterEach(() => {
  document.elementFromPoint = origEFP;
  document.body.innerHTML = "";
});

describeIf("isRectOnScreen", () => {
  it("accepts a rect that has area and intersects the viewport", () => {
    expect(S.isRectOnScreen(rect({ left: 10, top: 10, width: 100, height: 100 }))).toBe(true);
  });
  it("rejects zero-area rects and rects parked outside the viewport (slide-out wrapper at x = viewport width)", () => {
    expect(S.isRectOnScreen(rect({ left: 0, top: 0, width: 500, height: 0 }))).toBe(false);
    expect(S.isRectOnScreen(rect({ left: window.innerWidth, top: 0, width: 500, height: 800 }))).toBe(false);
    expect(S.isRectOnScreen(rect({ left: -600, top: 0, width: 500, height: 800 }))).toBe(false);
    expect(S.isRectOnScreen(null)).toBe(false);
  });
});

describeIf("isMarkerSurfaceVisibleAt (chat-age badge occlusion)", () => {
  const anchor = rect({ left: 100, top: 100, width: 40, height: 40 });
  it("is visible when the hit-test lands on the marker root itself or another marker", () => {
    const root = document.createElement("div");
    const inner = document.createElement("img");
    root.appendChild(inner);
    document.elementFromPoint = () => inner;
    expect(S.isMarkerSurfaceVisibleAt(anchor, root)).toBe(true);
    const other = document.createElement("div");
    other.className = "maplibregl-marker";
    const otherInner = document.createElement("span");
    other.appendChild(otherInner);
    document.body.appendChild(other);
    document.elementFromPoint = () => otherInner;
    expect(S.isMarkerSurfaceVisibleAt(anchor, root)).toBe(true);
  });
  it("is hidden when the profile pane, loading overlay or one of our panels covers the marker", () => {
    const root = document.createElement("div");
    for (const cls of ["his-profile", "loading-background", "sniffies-soft-panel"]) {
      const cover = document.createElement("div");
      cover.className = cls;
      document.body.appendChild(cover);
      document.elementFromPoint = () => cover;
      expect(S.isMarkerSurfaceVisibleAt(anchor, root)).toBe(false);
    }
  });
  it("treats a null hit (point outside the viewport) as covered, and a throwing hit-test as visible", () => {
    const root = document.createElement("div");
    document.elementFromPoint = () => null;
    expect(S.isMarkerSurfaceVisibleAt(anchor, root)).toBe(false);
    expect(S.isMarkerSurfaceVisibleAt(rect({ left: -50, top: 10, width: 20, height: 20 }), root)).toBe(false);
    document.elementFromPoint = () => { throw new Error("nope"); };
    expect(S.isMarkerSurfaceVisibleAt(anchor, root)).toBe(true);
  });
});

describeIf("adjustProfileWidgetsForOverlay (notes/reminder bars vs host banner)", () => {
  let container, notes, reminder, banner, bannerInner;
  beforeEach(() => {
    container = document.createElement("div");
    notes = document.createElement("div");
    notes.className = "sniffies-profile-notes";
    reminder = document.createElement("div");
    reminder.className = "sniffies-profile-reminder";
    banner = document.createElement("div");
    banner.className = "consent-banner";
    bannerInner = document.createElement("button");
    bannerInner.textContent = "Reveal";
    banner.appendChild(bannerInner);
    container.append(notes, reminder, banner);
    document.body.appendChild(container);
    setRect(container, { left: 0, top: 0, width: 480, height: 700 });
    setFlowRect(notes, { left: 0, top: 100, width: 480, height: 30 });
    setRect(reminder, { left: 0, top: 136, width: 480, height: 26 });
    setRect(banner, { left: 0, top: 96, width: 480, height: 44 });
    setRect(bannerInner, { left: 400, top: 104, width: 60, height: 28 });
  });

  it("pushes the notes bar below an overlay that hit-tests on top of it, climbing to the overlay's outer box", () => {
    document.elementFromPoint = () => bannerInner;
    const offset = S.adjustProfileWidgetsForOverlay(container);
    // banner.bottom (140) + 6px gap - natural top (100)
    expect(offset).toBe(46);
    expect(notes.style.marginTop).toBe("46px");
    expect(notes.dataset.overlayOffset).toBe("46");
  });

  it("is stable across passes: measures the natural position each time, so an applied offset never accumulates", () => {
    document.elementFromPoint = () => bannerInner;
    for (let i = 0; i < 4; i += 1) expect(S.adjustProfileWidgetsForOverlay(container)).toBe(46);
    expect(notes.style.marginTop).toBe("46px");
    // Even if something else overrode the stored offset, the measured pass corrects it.
    notes.style.marginTop = "300px";
    notes.dataset.overlayOffset = "300";
    expect(S.adjustProfileWidgetsForOverlay(container)).toBe(46);
    expect(notes.style.marginTop).toBe("46px");
  });

  it("drops the offset back to 0 once the overlay is gone (hit-test returns the container / an ancestor)", () => {
    document.elementFromPoint = () => bannerInner;
    S.adjustProfileWidgetsForOverlay(container);
    document.elementFromPoint = () => container;
    expect(S.adjustProfileWidgetsForOverlay(container)).toBe(0);
    expect(notes.style.marginTop).toBe("");
    document.elementFromPoint = () => document.body;
    expect(S.adjustProfileWidgetsForOverlay(container)).toBe(0);
  });

  it("ignores hits on our own widgets and never climbs into a box taller than the banner cap", () => {
    document.elementFromPoint = () => notes.appendChild(document.createElement("span"));
    expect(S.adjustProfileWidgetsForOverlay(container)).toBe(0);
    // Overlay nested in a full-height wrapper: the climb must stop below the wrapper.
    const tall = document.createElement("div");
    setRect(tall, { left: 0, top: 0, width: 480, height: 700 });
    container.appendChild(tall);
    tall.appendChild(banner);
    document.elementFromPoint = () => bannerInner;
    expect(S.adjustProfileWidgetsForOverlay(container)).toBe(46);
  });

  it("caps the offset and is a no-op without widgets or when the natural position is off-screen", () => {
    // Hit element itself is absurdly tall (climb stops at its 5000px parent, so the hit's own box is used).
    setRect(banner, { left: 0, top: 96, width: 480, height: 5000 });
    setRect(bannerInner, { left: 0, top: 96, width: 480, height: 5000 });
    document.elementFromPoint = () => bannerInner;
    expect(S.adjustProfileWidgetsForOverlay(container)).toBe(200);
    expect(S.adjustProfileWidgetsForOverlay(document.createElement("div"))).toBe(0);
    expect(S.adjustProfileWidgetsForOverlay(null)).toBe(0);
    setFlowRect(notes, { left: 0, top: -500, width: 480, height: 30 });
    notes.style.marginTop = "12px";
    notes.dataset.overlayOffset = "12";
    expect(S.adjustProfileWidgetsForOverlay(container)).toBe(12);
    expect(notes.style.marginTop).toBe("12px");
  });

  it("scheduleProfileWidgetOverlayChecks re-runs the adjustment on a timer and cancels prior one-shots", () => {
    document.elementFromPoint = () => bannerInner;
    S.scheduleProfileWidgetOverlayChecks(container);
    S.scheduleProfileWidgetOverlayChecks(container);
    expect(S.__state.profileWidgetOverlayTimers.length).toBe(4);
    vi.advanceTimersByTime(3000);
    expect(notes.style.marginTop).toBe("46px");
    S.clearProfileWidgetOverlayChecks();
    expect(S.__state.profileWidgetOverlayTimers.length).toBe(0);
  });
});
