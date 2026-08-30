import { describe, it, expect, beforeEach } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();
const mkId = (n) => String(n).padStart(24, "0").replace(/[^0-9a-f]/g, "a");

// 4 of the 10 applyHiding() gates previously had zero direct coverage: profile-terms exclude,
// 2h chat recency, repeated-delete, unanswered-out. Each also gates globalChatMessageHidden and
// the visibility-reason strings, so a silent predicate break has wide blast radius.
beforeEach(() => {
  S.__state.chatActivity.clear();
  S.__state.profileFilterCache.clear();
  if (S.__state.chatDeletionStats) {
    for (const k of Object.keys(S.__state.chatDeletionStats)) delete S.__state.chatDeletionStats[k];
  }
  S.__state.state.excludeProfileTermsEnabled = true;
  S.__state.state.hideRecentChats2h = false;
  S.__state.state.hideRepeatedDeleters = true;
  S.__state.state.hideUnansweredOut = true;
});

describe("shouldHideByProfileTerms", () => {
  it("hides when the filter cache holds a matched exclude term", () => {
    const p = mkId(1);
    S.__state.profileFilterCache.set(p, { excludeTerm: "spam", includeTerm: "" });
    expect(S.shouldHideByProfileTerms(p)).toBe(true);
  });
  it("does not hide without a match, and honors the master exclude toggle", () => {
    const p = mkId(2);
    expect(S.shouldHideByProfileTerms(p)).toBe(false);
    S.__state.profileFilterCache.set(p, { excludeTerm: "spam", includeTerm: "" });
    S.__state.state.excludeProfileTermsEnabled = false;
    expect(S.shouldHideByProfileTerms(p)).toBe(false);
  });
});

describe("shouldHideByRecentChats2h", () => {
  it("hides only interactions inside the 2h window, and only when enabled", () => {
    const p = mkId(3);
    const oneHourAgo = S.now() - 60 * 60 * 1000;
    S.__state.chatActivity.set(p, { myLastTs: oneHourAgo, theirLastTs: 0, anyLastTs: oneHourAgo, updatedAt: oneHourAgo });
    expect(S.shouldHideByRecentChats2h(p)).toBe(false); // disabled by default in this suite
    S.__state.state.hideRecentChats2h = true;
    expect(S.shouldHideByRecentChats2h(p)).toBe(true);
  });
  it("does not hide an interaction older than 2h", () => {
    const p = mkId(4);
    const threeHoursAgo = S.now() - 3 * 60 * 60 * 1000;
    S.__state.chatActivity.set(p, { myLastTs: threeHoursAgo, theirLastTs: 0, anyLastTs: threeHoursAgo, updatedAt: threeHoursAgo });
    S.__state.state.hideRecentChats2h = true;
    expect(S.shouldHideByRecentChats2h(p)).toBe(false);
  });
  it("never hides a profile with an unanswered recent reply (their message newer than mine)", () => {
    const p = mkId(5);
    const tenMinAgo = S.now() - 10 * 60 * 1000;
    S.__state.chatActivity.set(p, { myLastTs: tenMinAgo - 1000, theirLastTs: tenMinAgo, anyLastTs: tenMinAgo, updatedAt: tenMinAgo });
    S.__state.state.hideRecentChats2h = true;
    expect(S.shouldHideByRecentChats2h(p)).toBe(false);
  });
});

describe("shouldHideByRepeatedDelete", () => {
  it("hides at the 2-deletion threshold, not below", () => {
    const p = mkId(6);
    S.__state.chatDeletionStats[p] = { count: 1, lastDeletedTs: S.now() };
    expect(S.shouldHideByRepeatedDelete(p)).toBe(false);
    S.__state.chatDeletionStats[p] = { count: 2, lastDeletedTs: S.now() };
    expect(S.shouldHideByRepeatedDelete(p)).toBe(true);
  });
  it("is disabled by the hideRepeatedDeleters === false gate", () => {
    const p = mkId(7);
    S.__state.chatDeletionStats[p] = { count: 5, lastDeletedTs: S.now() };
    S.__state.state.hideRepeatedDeleters = false;
    expect(S.shouldHideByRepeatedDelete(p)).toBe(false);
  });
});

describe("shouldHideByUnansweredOut", () => {
  it("hides after 4+ unanswered outgoing messages, only while mine is newest", () => {
    const p = mkId(8);
    const t = S.now() - 1000;
    S.__state.chatActivity.set(p, { myLastTs: t, theirLastTs: t - 5000, anyLastTs: t, updatedAt: t, outRun: 4 });
    expect(S.shouldHideByUnansweredOut(p)).toBe(true);
    // A reply (their message newer) lifts the hide even with a long outgoing run.
    S.__state.chatActivity.set(p, { myLastTs: t, theirLastTs: t + 5000, anyLastTs: t + 5000, updatedAt: t, outRun: 6 });
    expect(S.shouldHideByUnansweredOut(p)).toBe(false);
  });
  it("does not hide below the threshold, and honors the off-gate", () => {
    const p = mkId(9);
    const t = S.now() - 1000;
    S.__state.chatActivity.set(p, { myLastTs: t, theirLastTs: 0, anyLastTs: t, updatedAt: t, outRun: 3 });
    expect(S.shouldHideByUnansweredOut(p)).toBe(false);
    S.__state.chatActivity.set(p, { myLastTs: t, theirLastTs: 0, anyLastTs: t, updatedAt: t, outRun: 9 });
    S.__state.state.hideUnansweredOut = false;
    expect(S.shouldHideByUnansweredOut(p)).toBe(false);
  });
});

describe("recentChatHours (configurable hide-window for shouldHideByRecentChats)", () => {
  beforeEach(() => {
    S.__state.chatActivity.clear();
    S.__state.state.hideRecentChats24h = true;
    S.__state.state.recentChatHours = 24;
  });

  it("honors the configured window: 6h window ignores a 12h-old chat, catches a 3h-old one", () => {
    const oldChat = mkId(20);
    const newChat = mkId(21);
    const t12h = S.now() - 12 * 60 * 60 * 1000;
    const t3h = S.now() - 3 * 60 * 60 * 1000;
    S.__state.chatActivity.set(oldChat, { myLastTs: t12h, theirLastTs: 0, anyLastTs: t12h, updatedAt: t12h });
    S.__state.chatActivity.set(newChat, { myLastTs: t3h, theirLastTs: 0, anyLastTs: t3h, updatedAt: t3h });
    // Default 24h window hides both.
    expect(S.shouldHideByRecentChats(oldChat)).toBe(true);
    expect(S.shouldHideByRecentChats(newChat)).toBe(true);
    // A 6h window releases the 12h-old chat, keeps the 3h-old one hidden.
    S.__state.state.recentChatHours = 6;
    expect(S.shouldHideByRecentChats(oldChat)).toBe(false);
    expect(S.shouldHideByRecentChats(newChat)).toBe(true);
  });

  it("recentChatHoursValue clamps to 1..168 and defaults to 24 on junk", () => {
    S.__state.state.recentChatHours = 0;
    expect(S.recentChatHoursValue()).toBe(24);
    S.__state.state.recentChatHours = 9999;
    expect(S.recentChatHoursValue()).toBe(168);
    S.__state.state.recentChatHours = "not a number";
    expect(S.recentChatHoursValue()).toBe(24);
    S.__state.state.recentChatHours = 48;
    expect(S.recentChatHoursValue()).toBe(48);
    expect(S.recentChatWindowMs()).toBe(48 * 60 * 60 * 1000);
  });

  it("the unanswered-reply keep-visible override still applies inside any window", () => {
    const p = mkId(22);
    const t1h = S.now() - 60 * 60 * 1000;
    // They wrote last (unanswered reply): stays visible even with a wide window.
    S.__state.chatActivity.set(p, { myLastTs: t1h - 5000, theirLastTs: t1h, anyLastTs: t1h, updatedAt: t1h });
    S.__state.state.recentChatHours = 168;
    expect(S.shouldHideByRecentChats(p)).toBe(false);
  });
});
