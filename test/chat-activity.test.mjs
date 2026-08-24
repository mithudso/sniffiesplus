import { describe, it, expect, beforeEach } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();
const MIN = 60_000, HOUR = 3_600_000;
const idA = "1111111111111111111111a1";
const idB = "2222222222222222222222b2";

describe("upsertChatActivity (monotonic max-wins)", () => {
  beforeEach(() => S.__state.chatActivity.clear());

  it("records my/their last-message times separately", () => {
    const t = S.now();
    S.upsertChatActivity(idA, t - HOUR, 0);   // I messaged 1h ago
    S.upsertChatActivity(idA, 0, t - 30 * MIN); // they replied 30m ago
    const e = S.__state.chatActivity.get(idA);
    expect(e.myLastTs).toBe(t - HOUR);
    expect(e.theirLastTs).toBe(t - 30 * MIN);
    expect(e.anyLastTs).toBe(t - 30 * MIN); // most recent of the two
  });

  it("never regresses a timestamp (replay-safe)", () => {
    const t = S.now();
    S.upsertChatActivity(idA, t - HOUR, 0);
    const changed = S.upsertChatActivity(idA, t - 3 * HOUR, 0); // older -> ignored
    expect(changed).toBe(false);
    expect(S.__state.chatActivity.get(idA).myLastTs).toBe(t - HOUR);
  });

  it("ignores entries with no usable timestamp", () => {
    expect(S.upsertChatActivity(idA, 0, 0)).toBe(false);
    expect(S.upsertChatActivity("not-an-id", S.now(), 0)).toBe(false);
  });
});

describe("computeLastActiveTs (max of connect/disconnect, clamped to now)", () => {
  it("takes the later of the two", () => {
    const t = S.now();
    expect(S.computeLastActiveTs(t - HOUR, t - 3 * HOUR)).toBe(t - HOUR);
    expect(S.computeLastActiveTs(t - 3 * HOUR, t - HOUR)).toBe(t - HOUR);
  });
  it("clamps a future timestamp to now (defends against 'valid-until' values)", () => {
    const t = S.now();
    expect(S.computeLastActiveTs(t + HOUR, t - 3 * HOUR)).toBe(t);
  });
  it("returns 0 when neither is usable", () => {
    expect(S.computeLastActiveTs(0, 0)).toBe(0);
    expect(S.computeLastActiveTs(null, undefined)).toBe(0);
  });
});

describe("recordProfileLastActive / getProfileLastActiveTs", () => {
  beforeEach(() => S.__state.profileLastActive.clear());
  it("stores the newest last-active and never regresses", () => {
    const t = S.now();
    expect(S.recordProfileLastActive(idA, t - HOUR)).toBe(true);
    expect(S.getProfileLastActiveTs(idA)).toBe(t - HOUR);
    expect(S.recordProfileLastActive(idA, t - 3 * HOUR)).toBe(false); // older -> ignored
    expect(S.getProfileLastActiveTs(idA)).toBe(t - HOUR);
    expect(S.recordProfileLastActive(idA, t - 10 * MIN)).toBe(true); // newer -> wins
    expect(S.getProfileLastActiveTs(idA)).toBe(t - 10 * MIN);
  });
  it("returns 0 for unknown profiles", () => {
    expect(S.getProfileLastActiveTs(idB)).toBe(0);
  });
});
