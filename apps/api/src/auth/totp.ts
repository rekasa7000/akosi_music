import { generateSecret, generateURI, verify } from "otplib";

const ISSUER = "Akosi Admin";

export function createTotpSecret(): string {
  return generateSecret();
}

export function buildTotpProvisioningUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

// otplib's default tolerance is tighter than the standard ±1 step
// (~30s each direction) real authenticator apps expect — without
// this, ordinary phone/server clock drift causes valid codes to be
// rejected. Confirmed by hitting exactly this during manual testing.
export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const result = await verify({ secret, token: code, epochTolerance: 30 });
  return result.valid;
}
