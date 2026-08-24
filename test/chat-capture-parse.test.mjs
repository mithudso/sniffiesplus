import { describe, it, expect } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();

// Pure parsers feeding the chat-activity timestamps that drive the 24h / "chatted ever" filters and
// chat-age badges. Each has a documented false-match guard that is exactly the kind that silently regresses.
describe("detectDirection (chat-capture)", () => {
  it("maps explicit boolean direction flags", () => {
    expect(S.detectDirection({ fromMe: true })).toBe("out");
    expect(S.detectDirection({ incoming: true })).toBe("in");
  });
  it("matches explicit direction string fields exactly", () => {
    expect(S.detectDirection({ direction: "in" })).toBe("in");
    expect(S.detectDirection({ messageDirection: "sent" })).toBe("out");
  });
  it("does NOT false-match generic type values like checkout/shout", () => {
    expect(S.detectDirection({ type: "checkout" })).toBe(null);
    expect(S.detectDirection({ type: "shout" })).toBe(null);
    expect(S.detectDirection({})).toBe(null);
    expect(S.detectDirection(null)).toBe(null);
  });
});

describe("extractEventTimestamp (chat-capture)", () => {
  it("prefers a priority key over other numeric fields", () => {
    expect(S.extractEventTimestamp({ seat: 1700000000000, createdAt: 1700000005000 })).toBe(1700000005000);
  });
  it("ignores non-timestamp suffix keys (e.g. seat) when no priority key is present", () => {
    expect(S.extractEventTimestamp({ seat: 1700000000000 })).toBe(0);
  });
  it("returns 0 for an empty or non-object payload", () => {
    expect(S.extractEventTimestamp({})).toBe(0);
    expect(S.extractEventTimestamp(null)).toBe(0);
  });
});

describe("parseWsPayloadText (chat-capture)", () => {
  it("drops numeric Socket.IO/Engine.IO control frames", () => {
    expect(S.parseWsPayloadText("2")).toBe(null);
    expect(S.parseWsPayloadText("3")).toBe(null);
  });
  it("parses a Socket.IO 42-prefixed event tuple's data argument", () => {
    expect(S.parseWsPayloadText('42["msg",{"id":"x"}]')).toMatchObject({ id: "x" });
  });
  it("caps oversized frames at ~1.5MB (returns null)", () => {
    const huge = "{" + "a".repeat(1_600_000) + "}";
    expect(S.parseWsPayloadText(huge)).toBe(null);
  });
});
