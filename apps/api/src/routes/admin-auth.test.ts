import { generate } from "otplib";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminUser, deleteUser, uniqueEmail } from "../test/fixtures.js";

// sendMail would otherwise try a real SMTP connection on every
// SET_EMAIL/LOGIN_MFA(email) step — mocked so these tests don't
// depend on mailpit being up, and so the OTP the route emails out
// can be read straight out of the mock's call args instead of an
// inbox.
const sendMailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../auth/mailer.js", () => ({ sendMail: sendMailMock }));

const { buildApp } = await import("../app.js");

function extractSixDigitCode(text: string): string {
  const match = text.match(/\b(\d{6})\b/);
  if (!match) throw new Error(`no 6-digit code found in mail text: ${text}`);
  return match[1];
}

function sessionCookieValue(res: { headers: Record<string, unknown> }): string {
  const header = res.headers["set-cookie"];
  const raw = Array.isArray(header) ? header[0] : header;
  const match = String(raw ?? "").match(/akosi_admin_session=([^;]+)/);
  if (!match) throw new Error("no admin session cookie in response");
  return match[1];
}

describe("admin auth routes", () => {
  let app: FastifyInstance;
  const createdUserIds: string[] = [];

  // Fresh app per test: several of these routes are rate-limited at
  // 5/min in-process, and these tests must stay order-independent
  // rather than silently sharing (and exhausting) one quota.
  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    sendMailMock.mockClear();
    while (createdUserIds.length) {
      await deleteUser(createdUserIds.pop()!);
    }
  });

  it("rejects an unknown email or a wrong password with the same 401", async () => {
    const unknown = await app.inject({
      method: "POST",
      url: "/admin/login",
      payload: { email: "nobody@test.akosi.invalid", password: "whatever12345" },
    });
    expect(unknown.statusCode).toBe(401);

    const user = await createAdminUser({ password: "correct-password-123" });
    createdUserIds.push(user.id);
    const wrongPassword = await app.inject({
      method: "POST",
      url: "/admin/login",
      payload: { email: user.email, password: "wrong-password-123" },
    });
    expect(wrongPassword.statusCode).toBe(401);
  });

  it("walks a brand-new bootstrap admin through the full setup chain to a session", async () => {
    const email = uniqueEmail("bootstrap");
    const user = await createAdminUser({ email, password: "bootstrap-pass-1" });
    createdUserIds.push(user.id);

    const login = await app.inject({
      method: "POST",
      url: "/admin/login",
      payload: { email, password: "bootstrap-pass-1" },
    });
    expect(login.json()).toMatchObject({ step: "SET_EMAIL" });
    const setupToken = login.json().challengeToken as string;

    const realEmail = uniqueEmail("real");
    const setEmail = await app.inject({
      method: "POST",
      url: "/admin/setup/email",
      payload: { challengeToken: setupToken, email: realEmail },
    });
    expect(setEmail.json()).toMatchObject({ step: "EMAIL_VERIFICATION" });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0]).toMatchObject({ to: realEmail });
    const emailCode = extractSixDigitCode(sendMailMock.mock.calls[0][0].text);

    const verifyEmail = await app.inject({
      method: "POST",
      url: "/admin/verify-email",
      payload: { challengeToken: setupToken, code: emailCode },
    });
    expect(verifyEmail.json()).toMatchObject({ step: "PASSWORD_SETUP" });
    const passwordToken = verifyEmail.json().challengeToken as string;

    const setPassword = await app.inject({
      method: "POST",
      url: "/admin/setup/password",
      payload: { challengeToken: passwordToken, password: "a-real-password-123" },
    });
    expect(setPassword.json()).toMatchObject({ step: "TOTP_ENROLLMENT" });
    const { challengeToken: totpToken, manualEntryKey } = setPassword.json();
    expect(manualEntryKey).toBeTruthy();

    const totpCode = await generate({ secret: manualEntryKey });
    const confirmTotp = await app.inject({
      method: "POST",
      url: "/admin/totp/confirm",
      payload: { challengeToken: totpToken, code: totpCode },
    });
    expect(confirmTotp.json()).toEqual({ step: "DONE" });
    const sessionCookie = sessionCookieValue(confirmTotp);

    const me = await app.inject({
      method: "GET",
      url: "/admin/me",
      cookies: { akosi_admin_session: sessionCookie },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ email: realEmail, role: "ADMIN" });
  });

  it("logs a fully set-up admin back in via email MFA", async () => {
    const email = uniqueEmail("returning");
    const user = await createAdminUser({
      email,
      password: "returning-pass-1",
      emailVerifiedAt: new Date(),
      passwordSetAt: new Date(),
      totpConfirmedAt: new Date(),
    });
    createdUserIds.push(user.id);

    const login = await app.inject({
      method: "POST",
      url: "/admin/login",
      payload: { email, password: "returning-pass-1" },
    });
    expect(login.json()).toMatchObject({ step: "SELECT_MFA_METHOD", availableMethods: ["EMAIL", "TOTP"] });
    const challengeToken = login.json().challengeToken as string;

    const selectMethod = await app.inject({
      method: "POST",
      url: "/admin/login/method",
      payload: { challengeToken, method: "EMAIL" },
    });
    expect(selectMethod.json()).toEqual({ step: "ENTER_CODE" });
    const code = extractSixDigitCode(sendMailMock.mock.calls[0][0].text);

    const verify = await app.inject({
      method: "POST",
      url: "/admin/login/verify",
      payload: { challengeToken, code },
    });
    expect(verify.json()).toEqual({ step: "DONE" });
    expect(verify.headers["set-cookie"]).toBeTruthy();
  });

  it("revokes every other open session the moment the password changes", async () => {
    const email = uniqueEmail("rotate");
    const user = await createAdminUser({
      email,
      password: "old-password-123",
      emailVerifiedAt: new Date(),
      passwordSetAt: new Date(),
      totpConfirmedAt: new Date(),
    });
    createdUserIds.push(user.id);

    // Two independent "browser" sessions for the same admin, e.g. two
    // devices both logged in before the password change.
    async function login(): Promise<string> {
      const res = await app.inject({
        method: "POST",
        url: "/admin/login",
        payload: { email, password: "old-password-123" },
      });
      const token = res.json().challengeToken as string;
      await app.inject({ method: "POST", url: "/admin/login/method", payload: { challengeToken: token, method: "EMAIL" } });
      const code = extractSixDigitCode(sendMailMock.mock.calls.at(-1)![0].text);
      const verify = await app.inject({ method: "POST", url: "/admin/login/verify", payload: { challengeToken: token, code } });
      return sessionCookieValue(verify);
    }

    const sessionA = await login();
    const sessionB = await login();

    // requireAdminSession compares JWT `iat` (whole-second precision)
    // against passwordSetAt floored to the same precision — a session
    // reissued in the very same wall-clock second as the password
    // change is deliberately treated as "not earlier" (see the comment
    // in session.ts), so this test needs a real second boundary
    // between minting sessionB and changing the password, not just
    // sequential awaits.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const changePassword = await app.inject({
      method: "POST",
      url: "/admin/change-password",
      cookies: { akosi_admin_session: sessionA },
      payload: { currentPassword: "old-password-123", newPassword: "new-password-456" },
    });
    expect(changePassword.statusCode).toBe(200);
    const sessionAReissued = sessionCookieValue(changePassword);

    const staleSessionB = await app.inject({
      method: "GET",
      url: "/admin/me",
      cookies: { akosi_admin_session: sessionB },
    });
    expect(staleSessionB.statusCode).toBe(401);

    const freshSessionA = await app.inject({
      method: "GET",
      url: "/admin/me",
      cookies: { akosi_admin_session: sessionAReissued },
    });
    expect(freshSessionA.statusCode).toBe(200);
  });

  it("rejects change-password with the wrong current password without killing the session", async () => {
    const email = uniqueEmail("wrongcur");
    const user = await createAdminUser({
      email,
      password: "right-password-123",
      emailVerifiedAt: new Date(),
      passwordSetAt: new Date(),
      totpConfirmedAt: new Date(),
    });
    createdUserIds.push(user.id);

    const login = await app.inject({
      method: "POST",
      url: "/admin/login",
      payload: { email, password: "right-password-123" },
    });
    const token = login.json().challengeToken as string;
    await app.inject({ method: "POST", url: "/admin/login/method", payload: { challengeToken: token, method: "EMAIL" } });
    const code = extractSixDigitCode(sendMailMock.mock.calls.at(-1)![0].text);
    const verify = await app.inject({ method: "POST", url: "/admin/login/verify", payload: { challengeToken: token, code } });
    const session = sessionCookieValue(verify);

    const attempt = await app.inject({
      method: "POST",
      url: "/admin/change-password",
      cookies: { akosi_admin_session: session },
      payload: { currentPassword: "totally-wrong", newPassword: "new-password-456" },
    });
    expect(attempt.statusCode).toBe(403);

    const stillValid = await app.inject({
      method: "GET",
      url: "/admin/me",
      cookies: { akosi_admin_session: session },
    });
    expect(stillValid.statusCode).toBe(200);
  });
});
