import { describe, it, expect, beforeEach } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();
// Feature gate: temp-block shipped in v0.12.0. Against an older source variant (harness resolves
// the highest version, or SNIFFIES_SRC_FILE overrides it) these suites skip instead of failing —
// the skip count then reports which features the target lacks.
const HAS_TEMP_BLOCK = typeof S.pruneExpiredTempBlocks === "function";
const describeIf = describe.skipIf(!HAS_TEMP_BLOCK);
const DAY = 24 * 60 * 60 * 1000;
const mkId = (n) => String(n).padStart(24, "0").replace(/[^0-9a-f]/g, "a");

beforeEach(() => {
  if (!HAS_TEMP_BLOCK) return;
  S.__state.blocked.clear();
  S.__state.tempBlockExpiresAt.clear();
  S.__state.state.tempBlockHours = 24;
  history.pushState({}, "", "/");
});

describeIf("tempBlockHoursValue (configurable Cmd+middle-click duration)", () => {
  it("defaults to 24 and reads back a configured value", () => {
    expect(S.tempBlockHoursValue()).toBe(24);
    S.__state.state.tempBlockHours = 3;
    expect(S.tempBlockHoursValue()).toBe(3);
    expect(S.tempBlockDurationMs()).toBe(3 * 60 * 60 * 1000);
  });
  it("clamps out-of-range and non-numeric values", () => {
    S.__state.state.tempBlockHours = 0;
    expect(S.tempBlockHoursValue()).toBe(24);
    S.__state.state.tempBlockHours = 9999;
    expect(S.tempBlockHoursValue()).toBe(168);
    S.__state.state.tempBlockHours = "not a number";
    expect(S.tempBlockHoursValue()).toBe(24);
  });
});

describeIf("hideProfileNow (temporary block via expiresAtMs)", () => {
  it("with no expiresAtMs blocks permanently and touches no temp-expiry state", () => {
    const p = mkId(1);
    expect(S.hideProfileNow(p)).toBe(true);
    expect(S.__state.blocked.has(p)).toBe(true);
    expect(S.__state.tempBlockExpiresAt.has(p)).toBe(false);
  });
  it("with expiresAtMs blocks and records the expiry", () => {
    const p = mkId(2);
    const expiresAt = S.now() + DAY;
    expect(S.hideProfileNow(p, null, expiresAt)).toBe(true);
    expect(S.__state.blocked.has(p)).toBe(true);
    expect(S.__state.tempBlockExpiresAt.get(p)).toBe(expiresAt);
  });
  it("is a no-op on an already-blocked id, temp or not", () => {
    const p = mkId(3);
    S.hideProfileNow(p);
    expect(S.hideProfileNow(p, null, S.now() + DAY)).toBe(false);
    expect(S.__state.tempBlockExpiresAt.has(p)).toBe(false);
  });
});

describeIf("pruneExpiredTempBlocks", () => {
  it("unblocks an id whose temp-block window has elapsed", () => {
    // Block with a real future expiry first -- hideProfileNow's own applyHiding() call runs
    // pruneExpiredTempBlocks() synchronously, so a PAST expiresAtMs would self-prune before this
    // test could ever observe the intermediate "still blocked" state. Backdating the expiry
    // afterward (bypassing hideProfileNow) simulates time actually elapsing.
    const p = mkId(10);
    S.hideProfileNow(p, null, S.now() + DAY);
    expect(S.__state.blocked.has(p)).toBe(true);
    S.__state.tempBlockExpiresAt.set(p, S.now() - 1);
    expect(S.pruneExpiredTempBlocks()).toBe(true);
    expect(S.__state.blocked.has(p)).toBe(false);
    expect(S.__state.tempBlockExpiresAt.has(p)).toBe(false);
  });
  it("leaves a temp block alone before it expires", () => {
    const p = mkId(11);
    S.hideProfileNow(p, null, S.now() + DAY);
    expect(S.pruneExpiredTempBlocks()).toBe(false);
    expect(S.__state.blocked.has(p)).toBe(true);
  });
  it("never touches a permanent (non-expiring) block", () => {
    const p = mkId(12);
    S.hideProfileNow(p);
    expect(S.pruneExpiredTempBlocks()).toBe(false);
    expect(S.__state.blocked.has(p)).toBe(true);
  });
  it("is a no-op when nothing is temp-blocked", () => {
    expect(S.pruneExpiredTempBlocks()).toBe(false);
  });
});

describeIf("unhideProfileNow clears any temp-expiry bookkeeping", () => {
  it("removes the id from tempBlockExpiresAt along with blocked", () => {
    const p = mkId(20);
    S.hideProfileNow(p, null, S.now() + DAY);
    expect(S.unhideProfileNow(p)).toBe(true);
    expect(S.__state.blocked.has(p)).toBe(false);
    expect(S.__state.tempBlockExpiresAt.has(p)).toBe(false);
  });
});

describeIf("handleMiddleMark: Cmd (metaKey) makes the block temporary", () => {
  const fakeEvent = (target, metaKey) => ({
    type: "mousedown", button: 1, metaKey, target,
    preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {},
  });

  it("plain middle-click (no metaKey) blocks permanently via the same expiresAtMs path handleMiddleMark uses", () => {
    // Full marker-hit-test DOM (maplibregl-marker structure) isn't practical to build in jsdom, so
    // this exercises hideProfileNow directly with the null expiresAtMs that handleMiddleMark passes
    // when e.metaKey is false -- the Global Chat tests below cover the metaKey branch end-to-end
    // through the real handleMiddleMark call.
    const p = mkId(30);
    expect(S.hideProfileNow(p, null, null)).toBe(true);
    expect(S.__state.tempBlockExpiresAt.has(p)).toBe(false);
  });

  it("resolves the author id off a Global Chat message and blocks temporarily under Cmd", () => {
    history.pushState({}, "", "/global-chat");
    const p = mkId(31);
    const msg = document.createElement("div");
    msg.setAttribute("data-testid", "globalChat-message");
    msg.id = p;
    document.body.append(msg);
    const before = S.now();
    S.handleMiddleMark(fakeEvent(msg, true));
    expect(S.__state.blocked.has(p)).toBe(true);
    const expiresAt = S.__state.tempBlockExpiresAt.get(p);
    expect(expiresAt).toBeGreaterThanOrEqual(before + DAY);
  });

  it("honors a configured tempBlockHours other than the 24h default", () => {
    S.__state.state.tempBlockHours = 3;
    history.pushState({}, "", "/global-chat");
    const p = mkId(33);
    const msg = document.createElement("div");
    msg.setAttribute("data-testid", "globalChat-message");
    msg.id = p;
    document.body.append(msg);
    const before = S.now();
    S.handleMiddleMark(fakeEvent(msg, true));
    const expiresAt = S.__state.tempBlockExpiresAt.get(p);
    const THREE_HOURS = 3 * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThanOrEqual(before + THREE_HOURS);
    expect(expiresAt).toBeLessThan(before + DAY);
  });

  it("resolves the author id off a Global Chat message and blocks permanently without Cmd", () => {
    history.pushState({}, "", "/global-chat");
    const p = mkId(32);
    const msg = document.createElement("div");
    msg.setAttribute("data-testid", "globalChat-message");
    msg.id = p;
    document.body.append(msg);
    S.handleMiddleMark(fakeEvent(msg, false));
    expect(S.__state.blocked.has(p)).toBe(true);
    expect(S.__state.tempBlockExpiresAt.has(p)).toBe(false);
  });
});
