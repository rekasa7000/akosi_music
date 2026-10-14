import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

// Gates PRIVATE release access for fans (docs/11-mvp-phase0.md's
// "Private (password) playback flow") — a single cookie listing every
// release this browser has unlocked, the stand-in for card-ownership
// checks until NFC auth exists. Swapping the verification step later
// means replacing this check inside the same routes, not
// rearchitecting them.

export const FAN_UNLOCK_COOKIE_NAME = "akosi_fan_unlock";
const UNLOCK_TTL_SECONDS = 24 * 60 * 60; // 24h, per docs/11-mvp-phase0.md

type UnlockPayload = { releaseIds: string[] };

export function getUnlockedReleaseIds(request: FastifyRequest): string[] {
  const token = request.cookies[FAN_UNLOCK_COOKIE_NAME];
  if (!token) return [];
  try {
    const payload = request.server.jwt.verify<UnlockPayload>(token);
    return payload.releaseIds ?? [];
  } catch {
    return [];
  }
}

export async function grantReleaseUnlock(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  releaseId: string,
): Promise<void> {
  const existing = getUnlockedReleaseIds(request);
  const releaseIds = existing.includes(releaseId) ? existing : [...existing, releaseId];
  const token = await app.jwt.sign({ releaseIds }, { expiresIn: UNLOCK_TTL_SECONDS });
  reply.setCookie(FAN_UNLOCK_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: UNLOCK_TTL_SECONDS,
  });
}
