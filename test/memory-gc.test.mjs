import { describe, it, expect, beforeEach } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();
const id = (n) => String(n).padStart(24, "0").replace(/[^0-9a-f]/g, "a");

beforeEach(() => {
  S.__state.idToMarker.clear();
  S.__state.attitudeCache.clear();
});

describe("runMemoryGc pruning", () => {
  it("prunes a stale off-map attitude entry but keeps an on-map one", () => {
    const stale = id(40), live = id(41);
    // ts:0 -> treated as stale by the retention check (a missing/zero ts is NOT 'just now').
    S.__state.attitudeCache.set(stale, { attitude: "top", ts: 0 });
    S.__state.attitudeCache.set(live, { attitude: "top", ts: 0 });
    // The marker sweep drops ids whose element isn't attached to document.body, so the survivor needs a
    // real attached node; otherwise it would be removed from idToMarker first and then pruned from the cache.
    const el = document.createElement("div");
    document.body.appendChild(el);
    S.__state.idToMarker.set(live, el);
    const res = S.runMemoryGc("test");
    expect(res.prunedAttitudes).toBeGreaterThanOrEqual(1);
    expect(S.__state.attitudeCache.has(stale)).toBe(false);
    expect(S.__state.attitudeCache.has(live)).toBe(true);
    el.remove();
  });

  it("reports the storage-digest cap counter (bounds the chatStorageDigestByKey cache)", () => {
    const res = S.runMemoryGc("test");
    expect(res).toHaveProperty("prunedStorageDigests");
    expect(typeof res.prunedStorageDigests).toBe("number");
  });
});

describe("teardownSniffies", () => {
  it("returns a count summary and is idempotent (no throw on a second call)", () => {
    const first = S.teardownSniffies();
    expect(first).toHaveProperty("timersCleared");
    expect(first).toHaveProperty("observersDisconnected");
    expect(() => S.teardownSniffies()).not.toThrow();
  });
});
