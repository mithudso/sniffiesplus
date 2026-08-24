import { describe, it, expect } from "vitest";

describe("tooling smoke", () => {
  it("runs vitest + esbuild", () => {
    expect(1 + 1).toBe(2);
  });
  it("has a jsdom document", () => {
    expect(typeof document).toBe("object");
    expect(document.createElement("div").tagName).toBe("DIV");
  });
});
