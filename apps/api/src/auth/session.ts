import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@akosi/database";

export const SESSION_COOKIE_NAME = "akosi_admin_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12h — admin-only, no refresh token
const TOKEN_TYPE = "admin-session" as const;

declare module "fastify" {
  interface FastifyRequest {
    adminUserId?: string;
  }
}

type SessionPayload = { type: typeof TOKEN_TYPE; sub: string; iat: number };

// This cookie and the fan-unlock cookie (fan-unlock.ts) are both JWTs
// signed with the same app-wide secret — without a type tag, a token
// meant for one purpose would verify successfully if replayed in the
// other's cookie slot (JWT type confusion, flagged by security
// review). Checking "type" explicitly, not just trusting whatever
// `sub` happens to be on the decoded payload, closes that off.
function isSessionPayload(payload: Record<string, unknown>): payload is SessionPayload {
  return (
    payload.type === TOKEN_TYPE && typeof payload.sub === "string" && typeof payload.iat === "number"
  );
}

export async function issueSession(
  app: FastifyInstance,
  reply: FastifyReply,
  userId: string,
): Promise<void> {
  const token = await app.jwt.sign({ type: TOKEN_TYPE, sub: userId }, { expiresIn: SESSION_TTL_SECONDS });
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    // Secure by default — see the matching note in fan-unlock.ts.
    // `=== "production"` failed *open* for any unset/misconfigured
    // NODE_ENV, silently dropping Secure and letting the admin
    // session cookie travel over plain HTTP.
    secure: process.env.NODE_ENV !== "development",
    // The web app and API live on different registrable domains in
    // production (Vercel vs Render), which makes every API call
    // cross-site, not just cross-origin — "strict"/"lax" silently
    // drop the cookie on those requests even with CORS configured
    // correctly, since SameSite and CORS are independent browser
    // mechanisms. "none" requires Secure, which is already forced
    // above. Dev stays same-site (shared "localhost"), so this is a
    // behavior change only in production.
    sameSite: process.env.NODE_ENV === "development" ? "strict" : "none",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSession(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
}

export async function requireAdminSession(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = request.cookies[SESSION_COOKIE_NAME];
  if (!token) {
    return reply.code(401).send({ error: "Not authenticated." });
  }
  try {
    const payload = request.server.jwt.verify<Record<string, unknown>>(token);
    if (!isSessionPayload(payload)) {
      return reply.code(401).send({ error: "Session expired or invalid." });
    }

    // Stateless JWTs have no server-side revocation list, so a stolen
    // or otherwise-still-open session would normally outlive a
    // password change entirely — the whole point of changing a
    // password after a suspected compromise is to kick everyone else
    // out. A token issued before the most recent passwordSetAt is
    // treated as revoked; /admin/change-password reissues a fresh
    // token for the session that actually made the change, so that
    // one stays logged in while every other one doesn't.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { passwordSetAt: true },
    });
    // JWT `iat` has whole-second precision (truncated, per spec) while
    // passwordSetAt keeps milliseconds — comparing them raw means a
    // token reissued in the very same second as the password change
    // (the common case: /admin/change-password reissues immediately
    // after writing passwordSetAt) looks "earlier" purely from
    // truncation, not any real ordering. Flooring passwordSetAt to
    // whole seconds too puts both sides on the same footing.
    const passwordSetAtSeconds = user?.passwordSetAt
      ? Math.floor(user.passwordSetAt.getTime() / 1000)
      : null;
    if (passwordSetAtSeconds !== null && payload.iat < passwordSetAtSeconds) {
      return reply.code(401).send({ error: "Session expired or invalid." });
    }

    request.adminUserId = payload.sub;
  } catch {
    return reply.code(401).send({ error: "Session expired or invalid." });
  }
}
