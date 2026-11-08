import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

// Gates PRIVATE tracks for fans — a track with at least one non-
// REVOKED Card pointing at it is private, and redeeming any of those
// cards' codes unlocks it (docs/11-mvp-phase0.md's "Private (password)
// playback flow", now scoped per-track via manually-provisioned cards
// instead of a release-wide shared password). This cookie is the
// stand-in for the card-ownership check real NFC auth will eventually
// perform at the same point in the request flow.

export const FAN_UNLOCK_COOKIE_NAME = "akosi_fan_unlock";
const UNLOCK_TTL_SECONDS = 24 * 60 * 60; // 24h, per docs/11-mvp-phase0.md
const TOKEN_TYPE = "fan-unlock" as const;

type UnlockEntry = { trackId: string; cardId: string };
type UnlockPayload = { type: typeof TOKEN_TYPE; unlocks: UnlockEntry[] };

// The admin session (session.ts) and this cookie are both JWTs signed
// with the same app-wide secret — without a type tag, a token meant
// for one purpose would verify successfully if replayed against the
// other's cookie slot (JWT type confusion). The explicit "type" claim
// plus a full shape check, not just trusting whatever's there, closes
// that off in both directions.
function isUnlockPayload(payload: Record<string, unknown>): payload is UnlockPayload {
  if (payload.type !== TOKEN_TYPE || !Array.isArray(payload.unlocks)) return false;
  const p = payload as { unlocks: unknown[] };
  return p.unlocks.every(
    (u): u is UnlockEntry =>
      typeof u === "object" &&
      u !== null &&
      typeof (u as Record<string, unknown>).trackId === "string" &&
      typeof (u as Record<string, unknown>).cardId === "string",
  );
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

// `activeCardIds` is the track's currently non-REVOKED card ids,
// loaded fresh by the caller on every check (not cached in the
// cookie) — revoking the specific card someone redeemed cuts their
// access immediately, even mid-cookie-lifetime, without needing a
// server-side token blocklist.
export function isTrackUnlocked(
  request: FastifyRequest,
  trackId: string,
  activeCardIds: string[],
): boolean {
  const entry = readUnlockPayload(request)?.unlocks.find((u) => u.trackId === trackId);
  return entry != null && activeCardIds.includes(entry.cardId);
}

// Which card (if any) is this request's proof for `trackId` — used to
// attribute a PlayEvent to the card that was actually tapped/redeemed.
export function getUnlockCardId(request: FastifyRequest, trackId: string): string | null {
  return readUnlockPayload(request)?.unlocks.find((u) => u.trackId === trackId)?.cardId ?? null;
}

export async function grantTrackUnlock(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  trackId: string,
  cardId: string,
): Promise<void> {
  const existing = readUnlockPayload(request)?.unlocks ?? [];
  const unlocks = [...existing.filter((u) => u.trackId !== trackId), { trackId, cardId }];
  const token = await app.jwt.sign({ type: TOKEN_TYPE, unlocks }, { expiresIn: UNLOCK_TTL_SECONDS });
  reply.setCookie(FAN_UNLOCK_COOKIE_NAME, token, {
    httpOnly: true,
    // Secure by default — only the explicit local-dev env (plain HTTP
    // on localhost) opts out.
    secure: process.env.NODE_ENV !== "development",
    // "lax" only attaches cookies to top-level GET navigations, not
    // JS-initiated fetch/POST from a different site — which is what
    // every /cards/redeem and /tracks/:id/play call from the deployed
    // web app actually is (Vercel vs Render are different sites, not
    // just different origins). See the matching comment in session.ts.
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
    path: "/",
    maxAge: UNLOCK_TTL_SECONDS,
  });
}
