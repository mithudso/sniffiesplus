import { describe, it, expect } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();

describe("normalizeAttitude canonicalization", () => {
  it("canonicalizes hyphenated vers-bottom and treats empty/null as unspecified", () => {
    expect(S.normalizeAttitude("vers-bottom")).toBe("vers-bottom");
    expect(S.normalizeAttitude("Vers-Bottom")).toBe("vers-bottom");
    expect(S.normalizeAttitude("")).toBe("unspecified");
    expect(S.normalizeAttitude(null)).toBe("unspecified");
  });
  it("a SPACE form like 'Vers Bottom' falls through to the generic 'bottom' bucket", () => {
    // The vers-bottom rule only matches the hyphenated/no-space forms. The global-chat parser hyphenates
    // spaces before calling this; a raw space form resolves to the broad 'bottom' bucket instead.
    expect(S.normalizeAttitude("Vers Bottom")).toBe("bottom");
  });
  it("recognizes side, power-bottom, and the broad top bucket", () => {
    expect(S.normalizeAttitude("side")).toBe("side");
    expect(S.normalizeAttitude("Power Bottom")).toBe("power-bottom");
    expect(S.normalizeAttitude("Total Top")).toBe("top");
  });
});

describe("extractAttitudeFromPartial (partials-feed parse)", () => {
  const wrap = (attitude) => ({ data: { profile: { extended: { sexuality: { attitude } } } } });
  it("pulls and normalizes a present attitude", () => {
    expect(S.extractAttitudeFromPartial(wrap("vers-bottom"))).toBe("vers-bottom");
  });
  it("returns 'unspecified' when the attitude key is present but empty", () => {
    expect(S.extractAttitudeFromPartial(wrap(""))).toBe("unspecified");
  });
  it("returns null when the attitude key is absent (unknown, distinct from unspecified)", () => {
    expect(S.extractAttitudeFromPartial({ data: { profile: { extended: { sexuality: {} } } } })).toBe(null);
    expect(S.extractAttitudeFromPartial({})).toBe(null);
  });
});
