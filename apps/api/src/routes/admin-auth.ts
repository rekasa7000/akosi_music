import type { FastifyInstance, FastifyReply } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { verify as verifyPasswordHash } from "argon2";
import { prisma } from "@akosi/database";
import {
  beginAccountSetup,
  submitSetupEmail,
  createPasswordSetupChallenge,
  consumePasswordSetupChallenge,
  createTotpEnrollmentChallenge,
  createLoginMfaChallenge,
  selectLoginMfaMethod,
  verifyChallengeCode,
} from "../auth/challenges.js";
import { issueSession, clearSession, requireAdminSession } from "../auth/session.js";

const Step = Type.Union([
  Type.Literal("SET_EMAIL"),
  Type.Literal("EMAIL_VERIFICATION"),
  Type.Literal("PASSWORD_SETUP"),
  Type.Literal("TOTP_ENROLLMENT"),
  Type.Literal("SELECT_MFA_METHOD"),
  Type.Literal("ENTER_CODE"),
  Type.Literal("DONE"),
]);

const ChallengeResponse = Type.Object({
  step: Step,
  challengeToken: Type.Optional(Type.String()),
  qrCodeDataUrl: Type.Optional(Type.String()),
  manualEntryKey: Type.Optional(Type.String()),
  availableMethods: Type.Optional(Type.Array(Type.String())),
});

const ErrorResponse = Type.Object({ error: Type.String() });

const REASON_STATUS: Record<string, number> = {
  not_found: 400,
  wrong_type: 400,
  already_consumed: 400,
  expired: 400,
  method_not_selected: 400,
  attempts_exhausted: 429,
  invalid_code: 401,
  email_taken: 409,
};

const REASON_MESSAGE: Record<string, string> = {
  not_found: "Invalid or expired challenge.",
  wrong_type: "Invalid challenge for this step.",
  already_consumed: "This challenge was already used. Please start over.",
  expired: "This code has expired. Please start over.",
  method_not_selected: "Select a verification method first.",
  attempts_exhausted: "Too many attempts. Please start over.",
  invalid_code: "Incorrect code.",
  email_taken: "This email is already in use.",
};

function sendChallengeError(reply: FastifyReply, reason: string) {
  const status = REASON_STATUS[reason] ?? 400;
  const message = REASON_MESSAGE[reason] ?? "Something went wrong.";
  return reply.code(status).send({ error: message });
}

export async function adminAuthRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.post(
    "/admin/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        body: Type.Object({
          // Not format: "email" — the bootstrap identity (e.g. "admin")
          // is deliberately not an email address. Only becomes a real
          // email once first-login setup replaces it.
          email: Type.String({ minLength: 1 }),
          password: Type.String({ minLength: 1 }),
        }),
        response: { 200: ChallengeResponse, 401: ErrorResponse },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const user = await prisma.user.findFirst({ where: { email, role: "ADMIN" } });

      const passwordOk =
        user?.passwordHash != null && (await verifyPasswordHash(user.passwordHash, password));
      if (!user || !passwordOk) {
        return reply.code(401).send({ error: "Invalid email or password." });
      }

      if (!user.emailVerifiedAt) {
        const { challengeToken } = await beginAccountSetup(user.id);
        return { step: "SET_EMAIL" as const, challengeToken };
      }

      const { challengeToken } = await createLoginMfaChallenge(user.id);
      return {
        step: "SELECT_MFA_METHOD" as const,
        challengeToken,
        availableMethods: ["EMAIL", "TOTP"],
      };
    },
  );

  typedApp.post(
    "/admin/setup/email",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        body: Type.Object({
          challengeToken: Type.String({ minLength: 1 }),
          email: Type.String({ format: "email" }),
        }),
        response: { 200: ChallengeResponse, 400: ErrorResponse, 409: ErrorResponse },
      },
    },
    async (request, reply) => {
      const { challengeToken, email } = request.body;
      const result = await submitSetupEmail(challengeToken, email);
      if (!result.ok) return sendChallengeError(reply, result.reason);
      return { step: "EMAIL_VERIFICATION" as const, challengeToken };
    },
  );

  typedApp.post(
    "/admin/verify-email",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        body: Type.Object({
          challengeToken: Type.String({ minLength: 1 }),
          code: Type.String({ minLength: 1 }),
        }),
        response: { 200: ChallengeResponse, 400: ErrorResponse, 401: ErrorResponse, 429: ErrorResponse },
      },
    },
    async (request, reply) => {
      const { challengeToken, code } = request.body;
      const result = await verifyChallengeCode(challengeToken, code, "EMAIL_VERIFICATION");
      if (!result.ok) return sendChallengeError(reply, result.reason);

      await prisma.user.update({
        where: { id: result.userId },
        data: { email: result.pendingEmail!, emailVerifiedAt: new Date() },
      });

      const { challengeToken: passwordToken } = await createPasswordSetupChallenge(result.userId);
      return { step: "PASSWORD_SETUP" as const, challengeToken: passwordToken };
    },
  );

  typedApp.post(
    "/admin/setup/password",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        body: Type.Object({
          challengeToken: Type.String({ minLength: 1 }),
          password: Type.String({ minLength: 12 }),
        }),
        response: { 200: ChallengeResponse, 400: ErrorResponse },
      },
    },
    async (request, reply) => {
      const { challengeToken, password } = request.body;
      const result = await consumePasswordSetupChallenge(challengeToken, password);
      if (!result.ok) return sendChallengeError(reply, result.reason);

      const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
      const totp = await createTotpEnrollmentChallenge(user.id, user.email);
      return {
        step: "TOTP_ENROLLMENT" as const,
        challengeToken: totp.challengeToken,
        qrCodeDataUrl: totp.qrCodeDataUrl,
        manualEntryKey: totp.manualEntryKey,
      };
    },
  );

  typedApp.post(
    "/admin/totp/confirm",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        body: Type.Object({
          challengeToken: Type.String({ minLength: 1 }),
          code: Type.String({ minLength: 1 }),
        }),
        response: { 200: ChallengeResponse, 400: ErrorResponse, 401: ErrorResponse, 429: ErrorResponse },
      },
    },
    async (request, reply) => {
      const { challengeToken, code } = request.body;
      const result = await verifyChallengeCode(challengeToken, code, "TOTP_ENROLLMENT");
      if (!result.ok) return sendChallengeError(reply, result.reason);

      await prisma.user.update({
        where: { id: result.userId },
        data: { totpConfirmedAt: new Date() },
      });
      await issueSession(app, reply, result.userId);
      return { step: "DONE" as const };
    },
  );

  typedApp.post(
    "/admin/login/method",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        body: Type.Object({
          challengeToken: Type.String({ minLength: 1 }),
          method: Type.Union([Type.Literal("EMAIL"), Type.Literal("TOTP")]),
        }),
        response: { 200: ChallengeResponse, 400: ErrorResponse },
      },
    },
    async (request, reply) => {
      const { challengeToken, method } = request.body;
      const result = await selectLoginMfaMethod(challengeToken, method);
      if (!result.ok) return sendChallengeError(reply, result.reason);
      return { step: "ENTER_CODE" as const };
    },
  );

  typedApp.post(
    "/admin/login/verify",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        body: Type.Object({
          challengeToken: Type.String({ minLength: 1 }),
          code: Type.String({ minLength: 1 }),
        }),
        response: { 200: ChallengeResponse, 400: ErrorResponse, 401: ErrorResponse, 429: ErrorResponse },
      },
    },
    async (request, reply) => {
      const { challengeToken, code } = request.body;
      const result = await verifyChallengeCode(challengeToken, code, "LOGIN_MFA");
      if (!result.ok) return sendChallengeError(reply, result.reason);

      await issueSession(app, reply, result.userId);
      return { step: "DONE" as const };
    },
  );

  typedApp.post("/admin/logout", async (_request, reply) => {
    clearSession(reply);
    return { step: "DONE" as const };
  });

  typedApp.get(
    "/admin/me",
    {
      preHandler: requireAdminSession,
      schema: {
        response: {
          200: Type.Object({ email: Type.String(), role: Type.String() }),
        },
      },
    },
    async (request) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: request.adminUserId! },
      });
      return { email: user.email, role: user.role };
    },
  );
}
