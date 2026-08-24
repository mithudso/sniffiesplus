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
    hideAnyChats: false, showOnlyChats: false, hideNotOnline2h: false, notOnlineWindowMinutes: 120,
  });
});

describe("configurable not-online window", () => {
  it("notOnlineWindowMinutesValue clamps to 1..1440", () => {
    S.__state.state.notOnlineWindowMinutes = 10;
    expect(S.notOnlineWindowMinutesValue()).toBe(10);
    S.__state.state.notOnlineWindowMinutes = 99999;
    expect(S.notOnlineWindowMinutesValue()).toBe(1440);
  });
  it("formats short labels (Nm, or Nh on whole hours)", () => {
    S.__state.state.notOnlineWindowMinutes = 10;
    expect(S.formatNotOnlineWindowShort()).toBe("10m");
    S.__state.state.notOnlineWindowMinutes = 90;
    expect(S.formatNotOnlineWindowShort()).toBe("90m");
    S.__state.state.notOnlineWindowMinutes = 120;
    expect(S.formatNotOnlineWindowShort()).toBe("2h");
  });
  it("formats long labels with correct pluralization", () => {
    S.__state.state.notOnlineWindowMinutes = 60;
    expect(S.formatNotOnlineWindowLong()).toBe("1 hour");
    S.__state.state.notOnlineWindowMinutes = 120;
    expect(S.formatNotOnlineWindowLong()).toBe("2 hours");
    S.__state.state.notOnlineWindowMinutes = 10;
    expect(S.formatNotOnlineWindowLong()).toBe("10 minutes");
  });
  it("hides a profile idle beyond a custom 10-minute window, shows one within it", () => {
    const t = S.now();
    Object.assign(S.__state.state, { hideNotOnline2h: true, notOnlineWindowMinutes: 10 });
    const offline = id(50), online = id(51);
    S.recordProfileLastActive(offline, t - 30 * MIN);   // 30m idle > 10m window -> hide
    S.recordProfileLastActive(online, t - 5 * MIN);     // 5m idle < 10m window -> show
    expect(S.shouldHideByNotOnlineWindow(offline)).toBe(true);
    expect(S.shouldHideByNotOnlineWindow(online)).toBe(false);
  });
});

describe("shouldHideByAnyChats / shouldHideByMissingChatHistory", () => {
  it("hideAnyChats hides any chat history but honors the unanswered-reply override", () => {
    const t = S.now(), p = id(60);
    S.__state.state.hideAnyChats = true;
    S.upsertChatActivity(p, t - 5 * HOUR, 0);            // I messaged; they never replied
    expect(S.shouldHideByAnyChats(p)).toBe(true);
    S.upsertChatActivity(p, t - 5 * HOUR, t - 1 * HOUR); // ...now they replied within 24h
    expect(S.shouldHideByAnyChats(p)).toBe(false);
  });
  it("showOnlyChats hides profiles with NO chat history", () => {
    const t = S.now(), withChat = id(61), noChat = id(62);
    S.__state.state.showOnlyChats = true;
    S.upsertChatActivity(withChat, t - 2 * HOUR, 0);
    expect(S.shouldHideByMissingChatHistory(noChat)).toBe(true);
    expect(S.shouldHideByMissingChatHistory(withChat)).toBe(false);
  });
});
