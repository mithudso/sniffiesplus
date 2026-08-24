import { describe, it, expect } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();
const fnNames = Object.keys(S).filter((k) => typeof S[k] === "function").sort();

describe("smoke: full function surface", () => {
  it("exposes every top-level function as a callable", () => {
    expect(fnNames.length).toBeGreaterThanOrEqual(419);
    for (const n of fnNames) expect(typeof S[n]).toBe("function");
  });

  // Calling each function bare exercises its entry path. A TypeError from a missing argument is
  // expected and ignored; a ReferenceError means a missing global or a TDZ access — a real bug
  // (this is precisely the failure class that the loadState/`state` TDZ crash was).
  it("no function raises a ReferenceError when called with no args", () => {
    // start from clean in-memory state so side effects don't cascade
    S.__state.idToMarker.clear();
    S.__state.chatActivity.clear();
    S.__state.profileLastActive.clear();

    const referenceErrors = [];
    for (const name of fnNames) {
      try {
        const r = S[name]();
        if (r && typeof r.then === "function") r.then(() => {}, () => {}); // swallow async rejections
      } catch (e) {
        if (e && e.name === "ReferenceError") referenceErrors.push(`${name}: ${e.message}`);
      }
    }
    expect(referenceErrors).toEqual([]);
  });
});
