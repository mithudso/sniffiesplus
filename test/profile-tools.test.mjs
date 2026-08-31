import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();
// Feature gates: occluded-badge hiding + on-screen container check shipped in v0.14.1; the profile
// tools moved into the Quick Phrases window in v0.15.0.
const HAS_OCCLUSION = typeof S.isMarkerSurfaceVisibleAt === "function";
const HAS_PROFILE_TOOLS = typeof S.buildProfileToolsSection === "function";
const describeOcc = describe.skipIf(!HAS_OCCLUSION);
const describeTools = describe.skipIf(!HAS_PROFILE_TOOLS);

// jsdom implements neither layout nor document.elementFromPoint; tests stub both.
const rect = ({ left = 0, top = 0, width = 0, height = 0 } = {}) => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top
});
const PID = "68032dba5a0ba1739108a16d";

let origEFP;
beforeEach(() => {
  origEFP = document.elementFromPoint;
});
afterEach(() => {
  document.elementFromPoint = origEFP;
  document.body.innerHTML = "";
  history.pushState({}, "", "/");
});

describeOcc("isRectOnScreen", () => {
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

describeOcc("isMarkerSurfaceVisibleAt (chat-age badge occlusion)", () => {
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

describeTools("profile tools in the Quick Phrases window", () => {
  beforeEach(() => {
    S.__state.state.showChatPhrasePanel = true;
    S.__state.blocked.clear();
    delete S.__state.notes[PID];
    S.__state.appointments.clear();
  });

  const panel = () => document.querySelector(".sniffies-chat-phrases-panel");

  it("buildProfileToolsSection returns notes + reminder widgets for a profile and null without one", () => {
    expect(S.buildProfileToolsSection(null)).toBeNull();
    const tools = S.buildProfileToolsSection(PID);
    expect(tools.className).toBe("sniffies-profile-tools");
    expect(tools.dataset.profileId).toBe(PID);
    expect(tools.querySelector(".sniffies-profile-notes")).toBeTruthy();
    expect(tools.querySelector(".sniffies-profile-reminder")).toBeTruthy();
    expect(tools.querySelectorAll(".sniffies-profile-rating-star").length).toBe(5);
    expect(tools.querySelector(".sniffies-profile-bookmark-btn").textContent).toBe("Bookmark");
    expect(tools.querySelector(".sniffies-profile-hide-btn").textContent).toBe("Hide this profile");
    // Empty note + no reminder → compact variant of both widgets.
    expect(tools.querySelector(".sniffies-profile-notes.compact-empty")).toBeTruthy();
    expect(tools.querySelector(".sniffies-profile-reminder.compact-empty")).toBeTruthy();
  });

  it("shows the window on a plain /profile/<id> view (no chat composer) with the Profile section mounted", () => {
    history.pushState({}, "", `/profile/${PID}`);
    S.renderChatPhrasePanel();
    const p = panel();
    expect(p).toBeTruthy();
    expect(p.style.display).toBe("flex");
    expect(p.dataset.profileId).toBe(PID);
    expect(p.querySelector("#sfChatProfileTools .sniffies-profile-tools")).toBeTruthy();
    // No composer → phrase buttons cannot send.
    const phraseBtn = p.querySelector(".phrase-btn");
    if (phraseBtn) expect(phraseBtn.disabled).toBe(true);
  });

  it("hides the window again when no profile is in context", () => {
    history.pushState({}, "", `/profile/${PID}`);
    S.renderChatPhrasePanel();
    history.pushState({}, "", "/");
    S.renderChatPhrasePanel();
    expect(panel().style.display).toBe("none");
  });

  it("reflects note text, rating and hidden state in the mounted section, and updateProfileNotesDisplay re-renders it", () => {
    history.pushState({}, "", `/profile/${PID}`);
    S.__state.notes[PID] = "tall, friendly";
    S.renderChatPhrasePanel();
    let p = panel();
    expect(p.querySelector(".sniffies-profile-notes-text").textContent).toBe("tall, friendly");
    expect(p.querySelector(".sniffies-profile-notes.compact-empty")).toBeNull();
    // Star click sets the rating and re-renders through updateProfileNotesDisplay.
    p.querySelectorAll(".sniffies-profile-rating-star")[2].click();
    p = panel();
    expect(p.querySelectorAll(".sniffies-profile-rating-star.active").length).toBe(3);
    // Hide button blocks the profile and disables itself.
    p.querySelector(".sniffies-profile-hide-btn").click();
    expect(S.__state.blocked.has(PID)).toBe(true);
    S.updateProfileNotesDisplay(PID);
    p = panel();
    expect(p.querySelector(".sniffies-profile-hide-btn").disabled).toBe(true);
    expect(p.querySelector(".sniffies-profile-hide-btn").textContent).toBe("Profile hidden");
  });

  it("nothing is injected into the profile pane any more", () => {
    const pane = document.createElement("div");
    pane.className = "his-profile";
    const content = document.createElement("div");
    content.className = "content";
    content.getBoundingClientRect = () => rect({ left: 900, top: 100, width: 480, height: 700 });
    for (let i = 0; i < 5; i += 1) content.appendChild(document.createElement("p"));
    pane.appendChild(content);
    document.body.appendChild(pane);
    history.pushState({}, "", `/profile/${PID}`);
    S.updateProfileNotesDisplay(PID);
    expect(pane.querySelector(".sniffies-profile-notes")).toBeNull();
    expect(pane.querySelector(".sniffies-profile-reminder")).toBeNull();
    expect(panel().querySelector(".sniffies-profile-notes")).toBeTruthy();
  });

  it("anchors beside the profile pane when there is no chat composer", () => {
    const pane = document.createElement("div");
    pane.id = "app-screen";
    pane.getBoundingClientRect = () => rect({ left: 700, top: 120, width: 480, height: 600 });
    document.body.appendChild(pane);
    const anchor = S.getChatPhraseAnchorRect();
    expect(anchor && anchor.left).toBe(700);
    pane.remove();
    expect(S.getChatPhraseAnchorRect()).toBeNull();
  });
});
