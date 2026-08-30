import { describe, it, expect, beforeEach, vi } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();
// The persisted rate record (loadRate/saveRate round-trip through the mocked localStorage).
const RATE_KEY = "sniffiesSoftFilterRate_v1";

// CLAUDE.md lists the request limiter as a hard constraint ("don't bypass the limiter"); nothing
// previously asserted that MAX_REQUESTS_PER_MIN (6) is enforced, that the rolling 60s window
// recovers, or that a server rate-limit cooldown actually blocks requests.
describe("request rate limiter (canRequest/noteRequest/noteRateLimit)", () => {
  beforeEach(() => {
    localStorage.removeItem(RATE_KEY);
  });

  it("allows requests up to the per-minute budget, then blocks", () => {
    expect(S.canRequest()).toBe(true);
    for (let i = 0; i < 6; i += 1) S.noteRequest();
    expect(S.canRequest()).toBe(false);
  });

  it("recovers once the rolling 60s window elapses", () => {
    for (let i = 0; i < 6; i += 1) S.noteRequest();
    expect(S.canRequest()).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(S.canRequest()).toBe(true);
  });

  it("a server rate-limit opens a cooldown that blocks until it lapses", () => {
    expect(S.canRequest()).toBe(true);
    S.noteRateLimit();
    expect(S.canRequest()).toBe(false);
    // COOLDOWN_MS is 10 minutes; 1ms before expiry still blocked, after it allowed.
    vi.advanceTimersByTime(10 * 60 * 1000 - 1);
    expect(S.canRequest()).toBe(false);
    vi.advanceTimersByTime(2);
    expect(S.canRequest()).toBe(true);
  });

  it("survives a corrupt persisted record (non-numeric fields must not NaN-block forever)", () => {
    localStorage.setItem(RATE_KEY, JSON.stringify({ windowStart: "abc", count: "xyz", cooldownUntil: "oops" }));
    // A NaN cooldown made canRequest() false forever while the pill read "6/6". Coercion must zero it.
    expect(S.canRequest()).toBe(true);
  });
});
