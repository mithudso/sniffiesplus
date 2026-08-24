import { describe, it, expect } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();
const MIN = 60_000, HOUR = 3_600_000;

describe("normalizeProfileId", () => {
  it("extracts a lowercased hex id from various shapes", () => {
    expect(S.normalizeProfileId("693322251F71B912A92A90AD")).toBe("693322251f71b912a92a90ad");
    expect(S.normalizeProfileId("/profile/693322251f71b912a92a90ad")).toBe("693322251f71b912a92a90ad");
  });
  it("returns null for non-ids", () => {
    expect(S.normalizeProfileId("xyz")).toBe(null);
    expect(S.normalizeProfileId(null)).toBe(null);
    expect(S.normalizeProfileId(undefined)).toBe(null);
  });
});

describe("parseTimestamp", () => {
  it("passes epoch ms through", () => {
    const t = S.now();
    expect(S.parseTimestamp(t)).toBe(t);
  });
  it("parses ISO-8601", () => {
    const iso = "2026-06-14T22:00:00.000Z";
    expect(S.parseTimestamp(iso)).toBe(Date.parse(iso));
  });
  it("treats a 10-digit string as epoch seconds", () => {
    expect(S.parseTimestamp("1700000000")).toBe(1_700_000_000 * 1000);
  });
  it("parses relative phrases", () => {
    expect(S.parseTimestamp("5 minutes ago")).toBe(S.now() - 5 * MIN);
  });
  it("returns 0 for junk / null", () => {
    expect(S.parseTimestamp("not a date")).toBe(0);
    expect(S.parseTimestamp(null)).toBe(0);
  });
});

describe("parseRelativeTimeString", () => {
  it("handles now and compact units", () => {
    const t = S.now();
    expect(S.parseRelativeTimeString("now")).toBe(t);
    expect(S.parseRelativeTimeString("5m")).toBe(t - 5 * MIN);
    expect(S.parseRelativeTimeString("2h")).toBe(t - 2 * HOUR);
  });
  it("returns 0 for empty/unknown", () => {
    expect(S.parseRelativeTimeString("")).toBe(0);
  });
});

describe("parsePhraseLines", () => {
  it("splits lines and drops blanks", () => {
    const out = S.parsePhraseLines("Howdy\nHey there\n\n   \n");
    expect(out).toContain("Howdy");
    expect(out).toContain("Hey there");
    expect(out.every((s) => s.trim().length > 0)).toBe(true);
  });
});
