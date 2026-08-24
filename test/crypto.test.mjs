import { describe, it, expect } from "vitest";
import { getInternals } from "./harness.mjs";

const S = getInternals();

describe("passphrase encryption (AES-GCM + PBKDF2)", () => {
  it("round-trips: decrypt(encrypt(x)) === x", async () => {
    const env = await S.encryptStringWithPassphrase("hello secret 🌮", "correct horse");
    expect(env).toBeTruthy();
    const out = await S.decryptStringWithPassphrase(env, "correct horse");
    expect(out).toBe("hello secret 🌮");
  });

  it("produces a fresh IV/salt each time (ciphertext differs for same input)", async () => {
    const a = await S.encryptStringWithPassphrase("same", "pw");
    const b = await S.encryptStringWithPassphrase("same", "pw");
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("rejects the wrong passphrase", async () => {
    const env = await S.encryptStringWithPassphrase("data", "right-pass");
    await expect(S.decryptStringWithPassphrase(env, "wrong-pass")).rejects.toBeTruthy();
  });
});

// The export/import integrity guarantee is the AES-GCM auth tag: a tampered or malformed envelope
// must fail closed (reject), never decrypt to garbage. importData() feeds attacker-pasteable JSON
// straight into decryptStringWithPassphrase, so these negative paths guard a real regression risk.
describe("passphrase decryption integrity (AES-GCM auth tag)", () => {
  it("rejects a tampered ciphertext", async () => {
    const env = await S.encryptStringWithPassphrase("integrity-protected payload", "pw");
    // Flip the first base64 char of the ciphertext (always a data byte, never padding) so the
    // decoded bytes change and the GCM auth tag check fails.
    const swapped = env.ciphertext[0] === "A" ? "B" : "A";
    const tampered = { ...env, ciphertext: swapped + env.ciphertext.slice(1) };
    await expect(S.decryptStringWithPassphrase(tampered, "pw")).rejects.toBeTruthy();
  });

  it("rejects a malformed envelope (empty salt/iv/ciphertext)", async () => {
    await expect(
      S.decryptStringWithPassphrase({ encrypted: true, salt: "", iv: "", ciphertext: "" }, "pw")
    ).rejects.toBeTruthy();
  });

  it("rejects an envelope missing its fields", async () => {
    await expect(S.decryptStringWithPassphrase({ encrypted: true }, "pw")).rejects.toBeTruthy();
  });
});
