import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { hash, verify as verifyPasswordHash } from "argon2";
import { prisma } from "@akosi/database";
import {
  issueArtistSession,
  clearArtistSession,
  requireArtistSession,
} from "../auth/artist-session.js";

const INVITE_TTL_DAYS = 7;

// Shared by /artist/login and /artist/setup/password so the two can't
// drift apart — a temp password that's too old to start the setup flow
// at /login must also be too old to complete it directly at
// /setup/password, which re-verifies currentPassword itself and would
// otherwise accept the same expired credential.
function isInviteExpired(invitedAt: Date | undefined): boolean {
  const expiresAt = new Date((invitedAt ?? new Date(0)).getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  return expiresAt < new Date();
}

const LoginResponse = Type.Union([
  Type.Object({ step: Type.Literal("PASSWORD_SETUP") }),
  Type.Object({ step: Type.Literal("DONE") }),
]);

const ErrorResponse = Type.Object({ error: Type.String() });

const Me = Type.Object({
  email: Type.String(),
  artistId: Type.String(),
  artistName: Type.String(),
  passwordSetAt: Type.Union([Type.String(), Type.Null()]),
});

export async function artistAuthRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.post(
    "/artist/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        body: Type.Object({
          email: Type.String({ minLength: 1 }),
          password: Type.String({ minLength: 1 }),
        }),
        response: { 200: LoginResponse, 401: ErrorResponse },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const user = await prisma.user.findFirst({
        where: { email, role: "ARTIST" },
        include: { artist: true },
      });

      const passwordOk =
        user?.passwordHash != null && (await verifyPasswordHash(user.passwordHash, password));
      if (!user || !passwordOk) {
        return reply.code(401).send({ error: "Invalid email or password." });
      }

      if (!user.passwordSetAt) {
        // Still on the temp password the admin's invite generated — the
        // invite has an implicit expiry (unlike admin's email/TOTP codes,
        // this credential has no natural short lifetime otherwise).
        if (isInviteExpired(user.artist?.invitedAt)) {
          return reply
            .code(401)
            .send({ error: "This invite has expired. Ask the platform team to resend it." });
        }
        return { step: "PASSWORD_SETUP" as const };
      }

      await issueArtistSession(app, reply, user.id);
      return { step: "DONE" as const };
    },
  );

  // Re-verifies currentPassword itself rather than trusting a prior step's
  // token — this means the same endpoint works both for completing a
  // forced first-login setup (currentPassword = the temp password) and,
  // later, a voluntary change-password from within the portal
  // (currentPassword = the real one), with no extra backend surface for
  // that fast-follow.
  typedApp.post(
    "/artist/setup/password",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        body: Type.Object({
          email: Type.String({ minLength: 1 }),
          currentPassword: Type.String({ minLength: 1 }),
          newPassword: Type.String({ minLength: 12 }),
        }),
        response: { 200: LoginResponse, 401: ErrorResponse },
      },
    },
    async (request, reply) => {
      const { email, currentPassword, newPassword } = request.body;
      const user = await prisma.user.findFirst({
        where: { email, role: "ARTIST" },
        include: { artist: true },
      });

      const passwordOk =
        user?.passwordHash != null && (await verifyPasswordHash(user.passwordHash, currentPassword));
      if (!user || !passwordOk) {
        return reply.code(401).send({ error: "Invalid email or password." });
      }

      // This endpoint also serves a voluntary change-password from within
      // the already-logged-in portal (see comment above), where
      // passwordSetAt is already set and invite expiry doesn't apply —
      // only gate the still-on-temp-password case, matching /artist/login.
      if (!user.passwordSetAt && isInviteExpired(user.artist?.invitedAt)) {
        return reply
          .code(401)
          .send({ error: "This invite has expired. Ask the platform team to resend it." });
      }

      const passwordHash = await hash(newPassword);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordSetAt: new Date() },
      });

      await issueArtistSession(app, reply, user.id);
      return { step: "DONE" as const };
    },
  );

  typedApp.post("/artist/logout", async (_request, reply) => {
    clearArtistSession(reply);
    return { ok: true };
  });

  typedApp.get(
    "/artist/me",
    {
      preHandler: requireArtistSession,
      schema: { response: { 200: Me, 401: ErrorResponse } },
    },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.artistUserId },
        include: { artist: true },
      });
      if (!user?.artist) {
        return reply.code(401).send({ error: "Not authenticated." });
      }
      return {
        email: user.email,
        artistId: user.artist.id,
        artistName: user.artist.name,
        passwordSetAt: user.passwordSetAt?.toISOString() ?? null,
      };
    },
  );
}
