import { hash, verify as verifyHash } from "argon2";
import { prisma } from "@akosi/database";
import type { AdminAuthChallengeMethod, AdminAuthChallengeType } from "@akosi/database";
import {
  encryptSecret,
  decryptSecret,
  generateChallengeToken,
  generateNumericCode,
} from "./crypto.js";
import { createTotpSecret, buildTotpProvisioningUri, verifyTotpCode } from "./totp.js";
import { sendMail } from "./mailer.js";
import QRCode from "qrcode";

export const MAX_ATTEMPTS = 5;
const EMAIL_CODE_TTL_MINUTES = 10;
const SETUP_TTL_MINUTES = 30;

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

const SETUP_CHAIN_TYPES = ["EMAIL_VERIFICATION", "PASSWORD_SETUP", "TOTP_ENROLLMENT"] as const;

// Kills every other unconsumed setup-chain challenge for this user.
// Without this, repeated /admin/login calls while setup is incomplete
// each mint a fresh, independently-valid EMAIL_VERIFICATION challenge
// — since the bootstrap credential is a shared/known value by design,
// that lets two parties race to finish setup with different emails/
// passwords, whoever completes last silently overwriting the other
// (flagged by security review as a potential account-takeover path).
// Called both when a new setup challenge is minted (so only the
// latest stays valid) and right after one is consumed (so a sibling
// created in between can't complete afterward).
async function invalidateOtherSetupChallenges(userId: string, exceptChallengeId?: string) {
  await prisma.adminAuthChallenge.updateMany({
    where: {
      userId,
      consumedAt: null,
      type: { in: [...SETUP_CHAIN_TYPES] },
      ...(exceptChallengeId ? { NOT: { id: exceptChallengeId } } : {}),
    },
    data: { consumedAt: new Date() },
  });
}

// First-login account setup (docs/12-admin-authentication.md). Starts
// an EMAIL_VERIFICATION challenge with no code yet — the bootstrap
// account's email (e.g. "admin") isn't a real address, so there's
// nothing to send a code to until the admin submits their actual
// email via submitSetupEmail.
export async function beginAccountSetup(userId: string) {
  const challenge = await prisma.adminAuthChallenge.create({
    data: {
      userId,
      type: "EMAIL_VERIFICATION",
      method: "EMAIL",
      token: generateChallengeToken(),
      expiresAt: minutesFromNow(SETUP_TTL_MINUTES),
    },
  });
  await invalidateOtherSetupChallenges(userId, challenge.id);
  return { challengeToken: challenge.token };
}

type SubmitEmailResult =
  | { ok: true }
  | {
      ok: false;
      reason: "not_found" | "wrong_type" | "already_consumed" | "expired" | "email_taken";
    };

// Can be called more than once on the same still-valid challenge — a
// typo should be correctable without restarting the whole login.
// Each call overwrites pendingEmail/codeHash and resets attempts,
// since it's effectively issuing a fresh code against a new target.
export async function submitSetupEmail(
  challengeToken: string,
  email: string,
): Promise<SubmitEmailResult> {
  const challenge = await prisma.adminAuthChallenge.findUnique({
    where: { token: challengeToken },
    include: { user: true },
  });
  if (!challenge) return { ok: false, reason: "not_found" };
  if (challenge.type !== "EMAIL_VERIFICATION") return { ok: false, reason: "wrong_type" };
  if (challenge.consumedAt) return { ok: false, reason: "already_consumed" };
  if (challenge.expiresAt < new Date()) return { ok: false, reason: "expired" };
  // Defense in depth: setup already completed via a sibling challenge
  // (e.g. a race invalidateOtherSetupChallenges didn't catch in time).
  // This challenge's own fields look fine in isolation, but the user
  // it belongs to is no longer mid-setup.
  if (challenge.user.emailVerifiedAt) return { ok: false, reason: "already_consumed" };

  const existing = await prisma.user.findFirst({
    where: { email, NOT: { id: challenge.userId } },
  });
  if (existing) return { ok: false, reason: "email_taken" };

  const code = generateNumericCode();
  const codeHash = await hash(code);
  await prisma.adminAuthChallenge.update({
    where: { id: challenge.id },
    data: { pendingEmail: email, codeHash, attempts: 0 },
  });
  await sendMail({
    to: email,
    subject: "Verify your Akosi admin email",
    text: `Your verification code is ${code}. It expires in ${EMAIL_CODE_TTL_MINUTES} minutes.`,
  });
  return { ok: true };
}

type CompleteEmailVerificationResult =
  | { ok: true }
  | { ok: false; reason: "already_consumed" };

// Called right after verifyChallengeCode succeeds for an
// EMAIL_VERIFICATION challenge. The User write is conditional
// (updateMany + count check) rather than a plain update — if a
// sibling challenge somehow won the race and already verified a
// *different* email first, this one must not silently overwrite it.
// Also invalidates any other still-live setup-chain challenges for
// this user; the one that was just consumed is already excluded by
// the consumedAt: null filter, and the follow-up PASSWORD_SETUP
// challenge is created by the caller *after* this returns, so it's
// never touched.
export async function completeEmailVerification(
  userId: string,
  pendingEmail: string,
): Promise<CompleteEmailVerificationResult> {
  const update = await prisma.user.updateMany({
    where: { id: userId, emailVerifiedAt: null },
    data: { email: pendingEmail, emailVerifiedAt: new Date() },
  });
  if (update.count === 0) {
    return { ok: false, reason: "already_consumed" };
  }
  await invalidateOtherSetupChallenges(userId);
  return { ok: true };
}

export async function createPasswordSetupChallenge(userId: string) {
  const challenge = await prisma.adminAuthChallenge.create({
    data: {
      userId,
      type: "PASSWORD_SETUP",
      token: generateChallengeToken(),
      expiresAt: minutesFromNow(SETUP_TTL_MINUTES),
    },
  });
  return { challengeToken: challenge.token };
}

type ConsumePasswordResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "not_found" | "wrong_type" | "already_consumed" | "expired" };

export async function consumePasswordSetupChallenge(
  challengeToken: string,
  newPassword: string,
): Promise<ConsumePasswordResult> {
  const challenge = await prisma.adminAuthChallenge.findUnique({ where: { token: challengeToken } });
  if (!challenge) return { ok: false, reason: "not_found" };
  if (challenge.type !== "PASSWORD_SETUP") return { ok: false, reason: "wrong_type" };
  if (challenge.consumedAt) return { ok: false, reason: "already_consumed" };
  if (challenge.expiresAt < new Date()) return { ok: false, reason: "expired" };

  // Same atomic-consume pattern as verifyChallengeCode — closes the
  // same class of race (two concurrent submissions both passing the
  // reads above before either records consumedAt).
  const consumption = await prisma.adminAuthChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  if (consumption.count === 0) {
    return { ok: false, reason: "already_consumed" };
  }

  const passwordHash = await hash(newPassword);
  await prisma.user.update({
    where: { id: challenge.userId },
    data: { passwordHash, passwordSetAt: new Date() },
  });
  await invalidateOtherSetupChallenges(challenge.userId);
  return { ok: true, userId: challenge.userId };
}

export async function createTotpEnrollmentChallenge(userId: string, email: string) {
  const secret = createTotpSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: encryptSecret(secret) },
  });
  const challenge = await prisma.adminAuthChallenge.create({
    data: {
      userId,
      type: "TOTP_ENROLLMENT",
      method: "TOTP",
      token: generateChallengeToken(),
      expiresAt: minutesFromNow(SETUP_TTL_MINUTES),
    },
  });
  const uri = buildTotpProvisioningUri(email, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(uri);
  return { challengeToken: challenge.token, qrCodeDataUrl, manualEntryKey: secret };
}

export async function createLoginMfaChallenge(userId: string) {
  const challenge = await prisma.adminAuthChallenge.create({
    data: {
      userId,
      type: "LOGIN_MFA",
      token: generateChallengeToken(),
      expiresAt: minutesFromNow(EMAIL_CODE_TTL_MINUTES),
    },
  });
  return { challengeToken: challenge.token };
}

type SelectMethodResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "already_consumed" | "wrong_type" };

export async function selectLoginMfaMethod(
  challengeToken: string,
  method: AdminAuthChallengeMethod,
): Promise<SelectMethodResult> {
  const challenge = await prisma.adminAuthChallenge.findUnique({
    where: { token: challengeToken },
    include: { user: true },
  });
  if (!challenge) return { ok: false, reason: "not_found" };
  if (challenge.type !== "LOGIN_MFA") return { ok: false, reason: "wrong_type" };
  if (challenge.consumedAt) return { ok: false, reason: "already_consumed" };
  if (challenge.expiresAt < new Date()) return { ok: false, reason: "expired" };

  if (method === "EMAIL") {
    const code = generateNumericCode();
    const codeHash = await hash(code);
    await prisma.adminAuthChallenge.update({
      where: { id: challenge.id },
      data: { method, codeHash },
    });
    await sendMail({
      to: challenge.user.email,
      subject: "Your Akosi admin login code",
      text: `Your login code is ${code}. It expires in ${EMAIL_CODE_TTL_MINUTES} minutes.`,
    });
  } else {
    await prisma.adminAuthChallenge.update({
      where: { id: challenge.id },
      data: { method },
    });
  }
  return { ok: true };
}

type VerifyResult =
  | { ok: true; userId: string; pendingEmail: string | null }
  | {
      ok: false;
      reason:
        | "not_found"
        | "expired"
        | "already_consumed"
        | "wrong_type"
        | "attempts_exhausted"
        | "method_not_selected"
        | "invalid_code";
    };

export async function verifyChallengeCode(
  challengeToken: string,
  code: string,
  expectedType: AdminAuthChallengeType,
): Promise<VerifyResult> {
  const challenge = await prisma.adminAuthChallenge.findUnique({
    where: { token: challengeToken },
    include: { user: true },
  });
  if (!challenge) return { ok: false, reason: "not_found" };
  if (challenge.type !== expectedType) return { ok: false, reason: "wrong_type" };
  if (challenge.consumedAt) return { ok: false, reason: "already_consumed" };
  if (challenge.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (challenge.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "attempts_exhausted" };
  if (!challenge.method) return { ok: false, reason: "method_not_selected" };

  // Atomically reserve this attempt *before* verifying the code.
  // Without this, concurrent requests against the same challenge can
  // all read the same stale `attempts` count and pass the check above
  // before any of them write their increment — collectively exceeding
  // MAX_ATTEMPTS via a burst of parallel guesses (flagged by security
  // review; the row-level WHERE here makes the DB serialize it).
  const reservation = await prisma.adminAuthChallenge.updateMany({
    where: {
      id: challenge.id,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: MAX_ATTEMPTS },
    },
    data: { attempts: { increment: 1 } },
  });
  if (reservation.count === 0) {
    return { ok: false, reason: "attempts_exhausted" };
  }

  const valid =
    challenge.method === "TOTP"
      ? await verifyAgainstTotp(challenge.user.totpSecret, code)
      : await verifyAgainstEmailCode(challenge.codeHash, code);

  if (!valid) {
    return { ok: false, reason: "invalid_code" };
  }

  // Atomically consume — without this, two concurrent requests that
  // both submit the correct code could both pass verification before
  // either records consumedAt, minting two sessions from one code.
  const consumption = await prisma.adminAuthChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumption.count === 0) {
    return { ok: false, reason: "already_consumed" };
  }

  return { ok: true, userId: challenge.userId, pendingEmail: challenge.pendingEmail };
}

async function verifyAgainstTotp(encryptedSecret: string | null, code: string): Promise<boolean> {
  if (!encryptedSecret) return false;
  return verifyTotpCode(decryptSecret(encryptedSecret), code);
}

async function verifyAgainstEmailCode(codeHash: string | null, code: string): Promise<boolean> {
  if (!codeHash) return false;
  return verifyHash(codeHash, code);
}
