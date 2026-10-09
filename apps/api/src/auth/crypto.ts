import { randomBytes, randomInt, createCipheriv, createDecipheriv } from "node:crypto";

// TOTP secret encryption at rest (AES-256-GCM). The key must be 32
// raw bytes — base64-encoded in env. This is the same category of
// secret as the NFC card master key (04-tech-stack.md): fine from an
// env var locally, must move to a real secrets manager/KMS before
// any real deployment.
function getEncryptionKey(): Buffer {
  const base64Key = process.env.TOTP_ENCRYPTION_KEY;
  if (!base64Key) {
    throw new Error("TOTP_ENCRYPTION_KEY is not set.");
  }
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error("TOTP_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return key;
}

const IV_LENGTH = 12; // GCM standard nonce size

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptSecret(encoded: string): string {
  const key = getEncryptionKey();
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = raw.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// High-entropy opaque bearer token for AdminAuthChallenge.token —
// deliberately not the row id, so a leaked log line with the id
// doesn't leak a usable token.
export function generateChallengeToken(): string {
  return randomBytes(32).toString("base64url");
}

// 6-digit numeric code for email-delivered OTPs (verification + MFA).
export function generateNumericCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
