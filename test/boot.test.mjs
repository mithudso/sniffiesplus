import { describe, it, expect, beforeAll } from "vitest";
import { getInternals, buildTestableSource } from "./harness.mjs";

describe("harness boot", () => {
  let S;
  beforeAll(() => { S = getInternals(); });

  it("boots the IIFE and exposes top-level functions", () => {
    const fnCount = Object.keys(S).filter((k) => typeof S[k] === "function").length;
    // Source-derived expectation (was a hand-typed floor that drifted below reality).
    expect(fnCount).toBe(buildTestableSource().functionNames.length);
  });

  it("has a jsdom document (environment canary, folded in from the deleted trivial.test.mjs)", () => {
    expect(document.createElement("div").tagName).toBe("DIV");
  });

  it("exposes live module-state handles", () => {
    expect(S.__state).toBeTruthy();
    expect(S.__state.chatActivity instanceof Map).toBe(true);
    expect(S.__state.attitudeCache instanceof Map).toBe(true);
  });

  it("a pure function actually runs: normalizeProfileId", () => {
    expect(S.normalizeProfileId("693322251f71b912a92a90ad")).toBe("693322251f71b912a92a90ad");
    expect(S.normalizeProfileId("nope")).toBe(null);
  });
});
