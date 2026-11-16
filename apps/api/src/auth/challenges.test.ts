import { hash } from "argon2";
import { prisma } from "@akosi/database";
import { afterEach, describe, expect, it } from "vitest";
import { createAdminUser, deleteUser } from "../test/fixtures.js";
import { generateChallengeToken } from "./crypto.js";
import { MAX_ATTEMPTS, verifyChallengeCode } from "./challenges.js";

// Exercises verifyChallengeCode's edge cases directly against a real
// challenge row rather than through the HTTP routes — the routes put
// an HTTP-level rate limit on the same endpoints at the same
// threshold as MAX_ATTEMPTS, which would make a 6th HTTP call
// ambiguous about which layer actually produced the 429. Testing the
// function directly isolates the attempt-counting invariant the code
// comments call out as security-reviewed.

async function createEmailChallenge(params: {
  userId: string;
  code: string;
  type?: "EMAIL_VERIFICATION" | "LOGIN_MFA";
  attempts?: number;
  expiresAt?: Date;
  consumedAt?: Date | null;
  withMethod?: boolean;
}) {
  const codeHash = await hash(params.code);
  return prisma.adminAuthChallenge.create({
    data: {
      userId: params.userId,
      type: params.type ?? "EMAIL_VERIFICATION",
      method: params.withMethod === false ? null : "EMAIL",
      token: generateChallengeToken(),
      codeHash,
      attempts: params.attempts ?? 0,
      expiresAt: params.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: params.consumedAt ?? null,
    },
  });
}

describe("verifyChallengeCode", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    while (createdUserIds.length) {
      await deleteUser(createdUserIds.pop()!);
    }
  });

  it("returns not_found for an unknown token", async () => {
    const result = await verifyChallengeCode("not-a-real-token", "123456", "EMAIL_VERIFICATION");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns wrong_type when the challenge type doesn't match what the caller expects", async () => {
    const user = await createAdminUser({ password: "bootstrap-password-123" });
    createdUserIds.push(user.id);
    const challenge = await createEmailChallenge({ userId: user.id, code: "123456" });

    const result = await verifyChallengeCode(challenge.token, "123456", "LOGIN_MFA");
    expect(result).toEqual({ ok: false, reason: "wrong_type" });
  });

  it("returns expired for a challenge past its expiry", async () => {
    const user = await createAdminUser({ password: "bootstrap-password-123" });
    createdUserIds.push(user.id);
    const challenge = await createEmailChallenge({
      userId: user.id,
      code: "123456",
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await verifyChallengeCode(challenge.token, "123456", "EMAIL_VERIFICATION");
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("returns already_consumed for a challenge that's already been used", async () => {
    const user = await createAdminUser({ password: "bootstrap-password-123" });
    createdUserIds.push(user.id);
    const challenge = await createEmailChallenge({
      userId: user.id,
      code: "123456",
      consumedAt: new Date(),
    });

    const result = await verifyChallengeCode(challenge.token, "123456", "EMAIL_VERIFICATION");
    expect(result).toEqual({ ok: false, reason: "already_consumed" });
  });

  it("succeeds on the right code, then refuses replay of the same token", async () => {
    const user = await createAdminUser({ password: "bootstrap-password-123" });
    createdUserIds.push(user.id);
    const challenge = await createEmailChallenge({ userId: user.id, code: "654321" });

    const first = await verifyChallengeCode(challenge.token, "654321", "EMAIL_VERIFICATION");
    expect(first).toEqual({ ok: true, userId: user.id, pendingEmail: null });

    const replay = await verifyChallengeCode(challenge.token, "654321", "EMAIL_VERIFICATION");
    expect(replay).toEqual({ ok: false, reason: "already_consumed" });
  });

  it("locks out after MAX_ATTEMPTS wrong codes, even once the right code is finally tried", async () => {
    const user = await createAdminUser({ password: "bootstrap-password-123" });
    createdUserIds.push(user.id);
    const challenge = await createEmailChallenge({ userId: user.id, code: "999999" });

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const attempt = await verifyChallengeCode(challenge.token, "000000", "EMAIL_VERIFICATION");
      expect(attempt).toEqual({ ok: false, reason: "invalid_code" });
    }

    // The attempt budget is exhausted — even the correct code must now
    // be rejected without a lockout bypass.
    const finalTry = await verifyChallengeCode(challenge.token, "999999", "EMAIL_VERIFICATION");
    expect(finalTry).toEqual({ ok: false, reason: "attempts_exhausted" });
  });

  it("returns method_not_selected for a LOGIN_MFA challenge whose method hasn't been chosen yet", async () => {
    const user = await createAdminUser({ password: "bootstrap-password-123" });
    createdUserIds.push(user.id);
    const challenge = await createEmailChallenge({
      userId: user.id,
      code: "123456",
      type: "LOGIN_MFA",
      withMethod: false,
    });

    const result = await verifyChallengeCode(challenge.token, "123456", "LOGIN_MFA");
    expect(result).toEqual({ ok: false, reason: "method_not_selected" });
  });
});
