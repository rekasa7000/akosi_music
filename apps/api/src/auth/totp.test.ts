import { generate } from "otplib";
import { describe, expect, it } from "vitest";
import { buildTotpProvisioningUri, createTotpSecret, verifyTotpCode } from "./totp.js";

describe("createTotpSecret / buildTotpProvisioningUri", () => {
  it("generates a secret and embeds it in the provisioning URI with the issuer and label", () => {
    const secret = createTotpSecret();
    expect(secret.length).toBeGreaterThan(0);

    const uri = buildTotpProvisioningUri("admin@akosi.music", secret);
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(encodeURIComponent("Akosi Admin"));
    expect(uri).toContain(secret);
    expect(uri).toContain(encodeURIComponent("admin@akosi.music"));
  });
});

describe("verifyTotpCode", () => {
  it("accepts a code generated from the same secret", async () => {
    const secret = createTotpSecret();
    const code = await generate({ secret });
    await expect(verifyTotpCode(secret, code)).resolves.toBe(true);
  });

  it("rejects a code generated from a different secret", async () => {
    const secret = createTotpSecret();
    const otherSecret = createTotpSecret();
    const code = await generate({ secret: otherSecret });
    await expect(verifyTotpCode(secret, code)).resolves.toBe(false);
  });

  it("rejects a garbage code", async () => {
    const secret = createTotpSecret();
    await expect(verifyTotpCode(secret, "000000")).resolves.toBe(false);
  });
});
