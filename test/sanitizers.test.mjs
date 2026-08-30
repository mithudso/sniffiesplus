import { describe, it, expect } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();

// sanitizeImageUrl is the codebase's only URL-scheme allow-list (avatar previews). Its rejection of
// dangerous schemes happens by falling through to the final `return ""` — the branch most likely to
// be broken by a well-meaning "support more paths" edit, so every rejection is pinned explicitly.
describe("sanitizeImageUrl (scheme allow-list)", () => {
  it("passes http(s) URLs through untouched", () => {
    expect(S.sanitizeImageUrl("https://x.example/y.png")).toBe("https://x.example/y.png");
    expect(S.sanitizeImageUrl("http://x.example/y.png")).toBe("http://x.example/y.png");
    expect(S.sanitizeImageUrl("HTTPS://x.example/y.png")).toBe("HTTPS://x.example/y.png");
  });
  it("upgrades protocol-relative and root-relative paths", () => {
    expect(S.sanitizeImageUrl("//cdn.example/x.png")).toBe("https://cdn.example/x.png");
    expect(S.sanitizeImageUrl("/img/a.png")).toBe("https://sniffies.com/img/a.png");
  });
  it("rejects every non-allow-listed scheme and shape", () => {
    expect(S.sanitizeImageUrl("javascript:alert(1)")).toBe("");
    expect(S.sanitizeImageUrl("data:text/html,<script>alert(1)</script>")).toBe("");
    expect(S.sanitizeImageUrl("blob:https://sniffies.com/abc")).toBe("");
    expect(S.sanitizeImageUrl("../rel.png")).toBe("");
    expect(S.sanitizeImageUrl("rel.png")).toBe("");
    expect(S.sanitizeImageUrl("")).toBe("");
    expect(S.sanitizeImageUrl(null)).toBe("");
    expect(S.sanitizeImageUrl(undefined)).toBe("");
  });
  it("trims before classifying", () => {
    expect(S.sanitizeImageUrl("  https://x.example/y.png  ")).toBe("https://x.example/y.png");
  });
});

describe("sanitizeMessageText (whitespace collapse + 240 cap)", () => {
  it("collapses internal whitespace and trims", () => {
    expect(S.sanitizeMessageText("  hey\n\n  there\t you ")).toBe("hey there you");
  });
  it("caps at 240 characters", () => {
    expect(S.sanitizeMessageText("x".repeat(500)).length).toBe(240);
  });
  it("returns '' for empty/nullish input", () => {
    expect(S.sanitizeMessageText("")).toBe("");
    expect(S.sanitizeMessageText("   ")).toBe("");
    expect(S.sanitizeMessageText(null)).toBe("");
  });
});
