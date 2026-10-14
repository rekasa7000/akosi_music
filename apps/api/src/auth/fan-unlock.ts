import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

// Gates PRIVATE release access for fans (docs/11-mvp-phase0.md's
// "Private (password) playback flow") — a single cookie listing every
// release this browser has unlocked, the stand-in for card-ownership
// checks until NFC auth exists. Swapping the verification step later
// means replacing this check inside the same routes, not
// rearchitecting them.

export const FAN_UNLOCK_COOKIE_NAME = "akosi_fan_unlock";
const UNLOCK_TTL_SECONDS = 24 * 60 * 60; // 24h, per docs/11-mvp-phase0.md
const TOKEN_TYPE = "fan-unlock" as const;

type UnlockEntry = { releaseId: string; passwordFingerprint: string };
type UnlockPayload = { type: typeof TOKEN_TYPE; unlocks: UnlockEntry[] };

// The admin session (session.ts) and this cookie are both JWTs signed
// with the same app-wide secret — without a type tag, a token meant
// for one purpose would verify successfully if replayed against the
// other's cookie slot (flagged by security review as JWT type
// confusion). The explicit "type" claim plus a full shape check
// (not just destructuring and trusting whatever's there) closes that
// off in both directions — see the matching check in
// requireAdminSession.
function isUnlockPayload(payload: Record<string, unknown>): payload is UnlockPayload {
  if (payload.type !== TOKEN_TYPE || !Array.isArray(payload.unlocks)) return false;
  const p = payload as { unlocks: unknown[] };
  return p.unlocks.every(
    (u): u is UnlockEntry =>
      typeof u === "object" &&
      u !== null &&
      typeof (u as Record<string, unknown>).releaseId === "string" &&
      typeof (u as Record<string, unknown>).passwordFingerprint === "string",
  );
}

// Ties an unlock to the release's password *at the time it was
// granted*, without storing the password hash itself in a
// client-held token. If the admin rotates a leaked password, every
// previously-issued unlock cookie stops matching this fingerprint on
// its next check — revoked for free, no server-side blocklist needed
// (closes the "unlock never expires even after password rotation"
// gap flagged by security review).
function fingerprint(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

function readUnlockPayload(request: FastifyRequest): UnlockPayload | null {
  const token = request.cookies[FAN_UNLOCK_COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = request.server.jwt.verify<Record<string, unknown>>(token);
    return isUnlockPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

export function isReleaseUnlocked(
  request: FastifyRequest,
  releaseId: string,
  currentPasswordHash: string,
): boolean {
  const entry = readUnlockPayload(request)?.unlocks.find((u) => u.releaseId === releaseId);
  return entry?.passwordFingerprint === fingerprint(currentPasswordHash);
}

export async function grantReleaseUnlock(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  releaseId: string,
  passwordHash: string,
): Promise<void> {
  const existing = readUnlockPayload(request)?.unlocks ?? [];
  const unlocks = [
    ...existing.filter((u) => u.releaseId !== releaseId),
    { releaseId, passwordFingerprint: fingerprint(passwordHash) },
  ];
  const token = await app.jwt.sign({ type: TOKEN_TYPE, unlocks }, { expiresIn: UNLOCK_TTL_SECONDS });
  reply.setCookie(FAN_UNLOCK_COOKIE_NAME, token, {
    httpOnly: true,
    // Secure by default — only the explicit local-dev env (plain HTTP
    // on localhost) opts out. The previous `=== "production"` check
    // failed *open*: any unset or misconfigured NODE_ENV (a staging
    // box, a typo) would silently drop the Secure flag and let this
    // cookie travel over plain HTTP (flagged by security review).
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: UNLOCK_TTL_SECONDS,
  });
}
