import { describe, it, expect } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();

describe("tracePreview / traceArgs (leak-resistant call-arg serializer)", () => {
  it("masks long strings, keeps short ones", () => {
    expect(S.tracePreview("x".repeat(200), 0)).toBe("[str:200]");
    expect(S.tracePreview("short id", 0)).toBe("short id");
  });
  it("redacts secret-looking keys, keeps the rest", () => {
    const r = S.tracePreview({ accessToken: "ya29.SECRET", password: "hunter2", code_verifier: "abc", user: "joe" }, 0);
    expect(r.accessToken).toBe("[redacted]");
    expect(r.password).toBe("[redacted]");
    expect(r.code_verifier).toBe("[redacted]");
    expect(r.user).toBe("joe");
  });
  it("cannot crash on circular refs or throwing getters", () => {
    const c = { a: 1 }; c.self = c;
    expect(() => S.tracePreview(c, 0)).not.toThrow();
    const trap = {};
    Object.defineProperty(trap, "boom", { enumerable: true, get() { throw new Error("nope"); } });
    expect(S.tracePreview(trap, 0).boom).toBe("[unreadable]");
  });
  it("caps args at 8 and notes the overflow", () => {
    function f() { return S.traceArgs(arguments); }
    const r = f(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    expect(r.length).toBe(9);
    expect(String(r[8])).toContain("10 args");
  });
});
