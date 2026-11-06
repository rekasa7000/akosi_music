import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@akosi/database";

// Structural mirror of session.ts for the ARTIST role — a separate cookie
// and JWT "type" tag (not just a separate secret) so an artist session and
// an admin session can coexist in the same browser without collision, and
// so a token minted for one can never verify against the other's guard.
export const ARTIST_SESSION_COOKIE_NAME = "akosi_artist_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12h, same as admin — no refresh token
const TOKEN_TYPE = "artist-session" as const;

declare module "fastify" {
  interface FastifyRequest {
    artistUserId?: string;
  }
}

type ArtistSessionPayload = { type: typeof TOKEN_TYPE; sub: string; iat: number };

function isArtistSessionPayload(payload: Record<string, unknown>): payload is ArtistSessionPayload {
  return (
    payload.type === TOKEN_TYPE && typeof payload.sub === "string" && typeof payload.iat === "number"
  );
}

export async function issueArtistSession(
  app: FastifyInstance,
  reply: FastifyReply,
  userId: string,
): Promise<void> {
  const token = await app.jwt.sign({ type: TOKEN_TYPE, sub: userId }, { expiresIn: SESSION_TTL_SECONDS });
  reply.setCookie(ARTIST_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearArtistSession(reply: FastifyReply): void {
  reply.clearCookie(ARTIST_SESSION_COOKIE_NAME, { path: "/" });
}

export async function requireArtistSession(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = request.cookies[ARTIST_SESSION_COOKIE_NAME];
  if (!token) {
    return reply.code(401).send({ error: "Not authenticated." });
  }
  try {
    const payload = request.server.jwt.verify<Record<string, unknown>>(token);
    if (!isArtistSessionPayload(payload)) {
      return reply.code(401).send({ error: "Session expired or invalid." });
    }

    // Same revocation trick as the admin session: a password reset (by the
    // artist themselves, or by an admin via the portal-reset action) should
    // invalidate any session issued before it, not just future logins.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { passwordSetAt: true },
    });
    const passwordSetAtSeconds = user?.passwordSetAt
      ? Math.floor(user.passwordSetAt.getTime() / 1000)
      : null;
    if (passwordSetAtSeconds !== null && payload.iat < passwordSetAtSeconds) {
      return reply.code(401).send({ error: "Session expired or invalid." });
    }

    request.artistUserId = payload.sub;
  } catch {
    return reply.code(401).send({ error: "Session expired or invalid." });
  }
}
