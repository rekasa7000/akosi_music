import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export const SESSION_COOKIE_NAME = "akosi_admin_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12h — admin-only, no refresh token
const TOKEN_TYPE = "admin-session" as const;

declare module "fastify" {
  interface FastifyRequest {
    adminUserId?: string;
  }
}

type SessionPayload = { type: typeof TOKEN_TYPE; sub: string };

// This cookie and the fan-unlock cookie (fan-unlock.ts) are both JWTs
// signed with the same app-wide secret — without a type tag, a token
// meant for one purpose would verify successfully if replayed in the
// other's cookie slot (JWT type confusion, flagged by security
// review). Checking "type" explicitly, not just trusting whatever
// `sub` happens to be on the decoded payload, closes that off.
function isSessionPayload(payload: Record<string, unknown>): payload is SessionPayload {
  return payload.type === TOKEN_TYPE && typeof payload.sub === "string";
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
    sameSite: "strict",
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
    request.adminUserId = payload.sub;
  } catch {
    return reply.code(401).send({ error: "Session expired or invalid." });
  }
}
