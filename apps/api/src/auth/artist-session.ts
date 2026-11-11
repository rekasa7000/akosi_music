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
    // See the matching comment in session.ts — the web app and API
    // are cross-site in production, so "strict" silently drops this
    // cookie on every request from the deployed frontend.
    sameSite: process.env.NODE_ENV === "development" ? "strict" : "none",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearArtistSession(reply: FastifyReply): void {
  // See the matching comment in session.ts's clearSession — must
  // match the secure/sameSite this cookie was issued with, or the
  // clearing Set-Cookie gets silently dropped by the browser in
  // production and logout doesn't actually take effect.
  reply.clearCookie(ARTIST_SESSION_COOKIE_NAME, {
    path: "/",
    secure: process.env.NODE_ENV !== "development",
    sameSite: process.env.NODE_ENV === "development" ? "strict" : "none",
  });
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
    //
    // Revocation epoch is the later of passwordSetAt and artist.invitedAt,
    // not passwordSetAt alone. admin-artists.ts's invite/resend/reset
    // action sets passwordSetAt back to null (to force PASSWORD_SETUP
    // again) while re-stamping invitedAt to now — with only passwordSetAt
    // checked here, a null value skipped the comparison entirely, so an
    // admin-initiated "reset portal password" (e.g. on a suspected
    // compromise) left any session issued before the reset valid until its
    // natural 12h expiry instead of being revoked immediately. invitedAt is
    // always set once an artist account exists, so it's a safe fallback
    // anchor rather than another nullable field that can fail open the
    // same way.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { passwordSetAt: true, artist: { select: { invitedAt: true, deletedAt: true } } },
    });
    if (!user) {
      return reply.code(401).send({ error: "Session expired or invalid." });
    }
    // Archiving an artist must revoke portal access immediately, on
    // every artist route — not just stop new logins. Checked here
    // centrally so no individual route can forget it.
    if (user.artist?.deletedAt) {
      return reply.code(401).send({ error: "Session expired or invalid." });
    }
    const passwordSetAtSeconds = user.passwordSetAt
      ? Math.floor(user.passwordSetAt.getTime() / 1000)
      : null;
    const invitedAtSeconds = user.artist ? Math.floor(user.artist.invitedAt.getTime() / 1000) : null;
    const revokeBeforeSeconds = Math.max(passwordSetAtSeconds ?? 0, invitedAtSeconds ?? 0);
    if (revokeBeforeSeconds > 0 && payload.iat < revokeBeforeSeconds) {
      return reply.code(401).send({ error: "Session expired or invalid." });
    }

    request.artistUserId = payload.sub;
  } catch {
    return reply.code(401).send({ error: "Session expired or invalid." });
  }
}
