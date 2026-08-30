import { describe, it, expect, afterEach } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();
const STATE_KEY = "sniffiesSoftFilterState_v2"; // newest STATE_KEYS entry (loaders read newest-first)

afterEach(() => { try { globalThis.__LS.removeItem(STATE_KEY); } catch (e) {} });

describe("loadState migration & coercion", () => {
  it("migrates legacy cannedMessages into introMessages", () => {
    globalThis.__LS.setItem(STATE_KEY, JSON.stringify({ cannedMessages: "Hi there\nHowdy" }));
    const st = S.loadState();
    expect(st.introMessages).toContain("Hi there");
  });
  it("forces showOnlyChats off when hideAnyChats is also set (mutually exclusive)", () => {
    globalThis.__LS.setItem(STATE_KEY, JSON.stringify({ hideAnyChats: true, showOnlyChats: true }));
    const st = S.loadState();
    expect(st.hideAnyChats).toBe(true);
    expect(st.showOnlyChats).toBe(false);
  });
  it("clamps an out-of-range notOnlineWindowMinutes to 1..1440", () => {
    globalThis.__LS.setItem(STATE_KEY, JSON.stringify({ notOnlineWindowMinutes: 99999 }));
    expect(S.loadState().notOnlineWindowMinutes).toBe(1440);
  });
  it("falls back to 120 for a non-numeric notOnlineWindowMinutes", () => {
    globalThis.__LS.setItem(STATE_KEY, JSON.stringify({ notOnlineWindowMinutes: "abc" }));
    expect(S.loadState().notOnlineWindowMinutes).toBe(120);
  });
});

describe("encrypted export round-trip (importData crypto layer)", () => {
  it("decrypts exactly what it encrypted", async () => {
    const env = await S.encryptStringWithPassphrase(JSON.stringify({ blocked: ["abc123abc123abc123abc123"] }), "pw");
    const back = JSON.parse(await S.decryptStringWithPassphrase(env, "pw"));
    expect(back.blocked).toContain("abc123abc123abc123abc123");
  });
});

// Multi-key fallback legs (the repo's documented migration convention): loaders must read an OLDER
// key when the newest is absent, prefer the newest when both exist, and save*() must land on the
// newest key. Previously only loadState's newest key was covered.
describe("multi-key fallback (STATE_KEYS / BLOCKED_KEYS)", () => {
  const OLD_STATE_KEY = "sniffiesSoftFilterState_v1";
  const NEW_BLOCKED_KEY = "sniffiesSoftFilterBlocked_v2";
  const OLD_BLOCKED_KEY = "sniffiesSoftFilterBlocked_v1";
  const ID_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const ID_B = "bbbbbbbbbbbbbbbbbbbbbbbb";

  afterEach(() => {
    for (const k of [STATE_KEY, OLD_STATE_KEY, NEW_BLOCKED_KEY, OLD_BLOCKED_KEY]) {
      try { globalThis.__LS.removeItem(k); } catch (e) {}
    }
  });

  it("loadState falls back to an older key when the newest is absent", () => {
    globalThis.__LS.setItem(OLD_STATE_KEY, JSON.stringify({ hideBottom: true }));
    expect(S.loadState().hideBottom).toBe(true);
  });

  it("loadState prefers the newest key when both exist", () => {
    globalThis.__LS.setItem(OLD_STATE_KEY, JSON.stringify({ hideBottom: true }));
    globalThis.__LS.setItem(STATE_KEY, JSON.stringify({ hideBottom: false }));
    expect(S.loadState().hideBottom).toBe(false);
  });

  it("loadBlockedSet falls back to an older key, prefers the newest, and normalizes ids", () => {
    globalThis.__LS.setItem(OLD_BLOCKED_KEY, JSON.stringify([ID_A]));
    expect(S.loadBlockedSet().has(ID_A)).toBe(true);
    globalThis.__LS.setItem(NEW_BLOCKED_KEY, JSON.stringify([ID_B.toUpperCase()]));
    const set = S.loadBlockedSet();
    expect(set.has(ID_B)).toBe(true); // normalized to lowercase
    expect(set.has(ID_A)).toBe(false); // newest key wins outright
  });

  it("a corrupt newest state key falls through (to older key or defaults) instead of crashing", () => {
    globalThis.__LS.setItem(STATE_KEY, "{not json");
    globalThis.__LS.setItem(OLD_STATE_KEY, JSON.stringify({ hideBottom: true }));
    expect(S.loadState().hideBottom).toBe(true);
  });
});
