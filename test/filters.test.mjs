import { describe, it, expect, beforeEach } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();
const MIN = 60_000, HOUR = 3_600_000;
const id = (n) => String(n).padStart(24, "0").replace(/[^0-9a-f]/g, "a");

beforeEach(() => {
  S.__state.chatActivity.clear();
  S.__state.profileLastActive.clear();
  S.__state.idToMarker.clear();
  Object.assign(S.__state.state, {
    hideRecentChats24h: false, hideAnyChats: false, showOnlyChats: false, hideNotOnline2h: false,
  });
});

describe("hasUnansweredRecentReply (feature #1 trigger)", () => {
  it("true when THEY spoke last within 24h", () => {
    const t = S.now(), p = id(1);
    S.upsertChatActivity(p, t - 2 * HOUR /*me*/, t - 1 * HOUR /*them*/);
    expect(S.hasUnansweredRecentReply(p)).toBe(true);
  });
  it("false when I spoke last", () => {
    const t = S.now(), p = id(2);
    S.upsertChatActivity(p, t - 1 * HOUR /*me*/, t - 2 * HOUR /*them*/);
    expect(S.hasUnansweredRecentReply(p)).toBe(false);
  });
  it("false when their reply is older than 24h", () => {
    const t = S.now(), p = id(3);
    S.upsertChatActivity(p, t - 50 * HOUR /*me*/, t - 30 * HOUR /*them*/);
    expect(S.hasUnansweredRecentReply(p)).toBe(false);
  });
  it("false when there is no chat history", () => {
    expect(S.hasUnansweredRecentReply(id(4))).toBe(false);
  });
});

describe("shouldHideByNotOnlineWindow (feature #2)", () => {
  it("hides a profile last online >2h ago", () => {
    const t = S.now(), p = id(10);
    S.__state.state.hideNotOnline2h = true;
    S.recordProfileLastActive(p, t - 3 * HOUR);
    expect(S.shouldHideByNotOnlineWindow(p)).toBe(true);
  });
  it("shows a profile online within 2h", () => {
    const t = S.now(), p = id(11);
    S.__state.state.hideNotOnline2h = true;
    S.recordProfileLastActive(p, t - 1 * HOUR);
    expect(S.shouldHideByNotOnlineWindow(p)).toBe(false);
  });
  it("shows a profile whose last-active is unknown (show-until-known)", () => {
    S.__state.state.hideNotOnline2h = true;
    expect(S.shouldHideByNotOnlineWindow(id(12))).toBe(false);
  });
  it("never hides when an unanswered reply is pending (reply override)", () => {
    const t = S.now(), p = id(13);
    S.__state.state.hideNotOnline2h = true;
    S.recordProfileLastActive(p, t - 5 * HOUR);        // offline >2h
    S.upsertChatActivity(p, t - 4 * HOUR, t - 2 * HOUR); // ...but they replied last
    expect(S.shouldHideByNotOnlineWindow(p)).toBe(false);
  });
  it("does nothing when the filter is off", () => {
    const t = S.now(), p = id(14);
    S.recordProfileLastActive(p, t - 5 * HOUR);
    expect(S.shouldHideByNotOnlineWindow(p)).toBe(false);
  });
});

describe("shouldHideByRecentChats (feature #1: unhide on reply)", () => {
  it("hides when I spoke last within 24h", () => {
    const t = S.now(), p = id(20);
    S.__state.state.hideRecentChats24h = true;
    S.upsertChatActivity(p, t - 1 * HOUR /*me*/, t - 2 * HOUR /*them*/);
    expect(S.shouldHideByRecentChats(p)).toBe(true);
  });
  it("UNHIDES the moment they reply", () => {
    const t = S.now(), p = id(21);
    S.__state.state.hideRecentChats24h = true;
    S.upsertChatActivity(p, t - 2 * HOUR /*me*/, t - 1 * HOUR /*them*/); // they replied last
    expect(S.shouldHideByRecentChats(p)).toBe(false);
  });
});

describe("countNotOnlineProfilesOnMap", () => {
  it("counts only on-map profiles that the 2h filter would hide", () => {
    const t = S.now();
    const offline = id(30), online = id(31), replied = id(32);
    for (const p of [offline, online, replied]) S.__state.idToMarker.set(p, {});
    S.recordProfileLastActive(offline, t - 3 * HOUR);   // counts
    S.recordProfileLastActive(online, t - 30 * MIN);    // online -> no
    S.recordProfileLastActive(replied, t - 3 * HOUR);
    S.upsertChatActivity(replied, t - 4 * HOUR, t - 1 * HOUR); // reply override -> no
    expect(S.countNotOnlineProfilesOnMap()).toBe(1);
  });
});
