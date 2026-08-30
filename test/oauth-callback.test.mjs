import { describe, it, expect } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();

// parseOAuthCallbackInput is the entry point for the PKCE `state` CSRF check. The legacy direct-
// token path intentionally returns state:"" (bypassing state verification for a hand-pasted
// ya29. token) — pinned here so any future change to that blast radius fails loudly.
describe("parseOAuthCallbackInput", () => {
  it("parses a full redirect URL with code + state", () => {
    const r = S.parseOAuthCallbackInput("https://example.com/cb?code=abc123&state=xyz789");
    expect(r.code).toBe("abc123");
    expect(r.state).toBe("xyz789");
    expect(r.accessToken).toBe("");
    expect(r.error).toBe("");
  });

  it("falls back to the hash fragment when the query holds no code/token", () => {
    const r = S.parseOAuthCallbackInput("https://example.com/cb#access_token=tok123&state=st1");
    expect(r.accessToken).toBe("tok123");
    expect(r.state).toBe("st1");
  });

  it("parses a bare query string, with or without the leading '?'", () => {
    expect(S.parseOAuthCallbackInput("?code=c1&state=s1").code).toBe("c1");
    expect(S.parseOAuthCallbackInput("code=c2&state=s2").state).toBe("s2");
  });

  it("surfaces provider errors", () => {
    const r = S.parseOAuthCallbackInput("https://example.com/cb?error=access_denied&error_description=nope");
    expect(r.error).toBe("access_denied");
    expect(r.errorDescription).toBe("nope");
    expect(r.code).toBe("");
  });

  it("legacy ya29. token paste bypasses URL parsing AND state verification (state stays empty)", () => {
    const r = S.parseOAuthCallbackInput("ya29.a0AbCdEfGh");
    expect(r.accessToken).toBe("ya29.a0AbCdEfGh");
    expect(r.state).toBe("");
    expect(r.code).toBe("");
  });

  it("empty input yields the all-empty shape", () => {
    const r = S.parseOAuthCallbackInput("");
    expect(r).toEqual({ code: "", state: "", accessToken: "", error: "", errorDescription: "" });
  });
});
