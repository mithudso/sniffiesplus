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
