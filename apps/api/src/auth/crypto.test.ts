import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, generateChallengeToken, generateNumericCode } from "./crypto.js";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a plaintext secret", () => {
    const ciphertext = encryptSecret("my-totp-secret");
    expect(decryptSecret(ciphertext)).toBe("my-totp-secret");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same-input");
    const b = encryptSecret("same-input");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same-input");
    expect(decryptSecret(b)).toBe("same-input");
  });

  it("rejects a ciphertext tampered with after encryption (GCM auth tag)", () => {
    const ciphertext = encryptSecret("my-totp-secret");
    const raw = Buffer.from(ciphertext, "base64");
    raw[raw.length - 1] ^= 0xff; // flip a bit in the ciphertext tail
    const tampered = raw.toString("base64");
    expect(() => decryptSecret(tampered)).toThrow();
  });
});

describe("generateChallengeToken", () => {
  it("returns a high-entropy, URL-safe, unique token each call", () => {
    const a = generateChallengeToken();
    const b = generateChallengeToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
});

describe("generateNumericCode", () => {
  it("always returns a zero-padded 6-digit string", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateNumericCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});
