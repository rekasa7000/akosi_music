import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export const SESSION_COOKIE_NAME = "akosi_admin_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12h — admin-only, no refresh token

declare module "fastify" {
  interface FastifyRequest {
    adminUserId?: string;
  }
}

export async function issueSession(
  app: FastifyInstance,
  reply: FastifyReply,
  userId: string,
): Promise<void> {
  const token = await app.jwt.sign({ sub: userId }, { expiresIn: SESSION_TTL_SECONDS });
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
    const payload = request.server.jwt.verify<{ sub: string }>(token);
    request.adminUserId = payload.sub;
  } catch {
    return reply.code(401).send({ error: "Session expired or invalid." });
  }
}
