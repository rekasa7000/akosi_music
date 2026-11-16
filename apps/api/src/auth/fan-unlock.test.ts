import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAN_UNLOCK_COOKIE_NAME, getUnlockCardId, grantTrackUnlock, isTrackUnlocked } from "./fan-unlock.js";

// grantTrackUnlock/isTrackUnlocked/getUnlockCardId only need cookie +
// jwt plugins (not the rest of the real app), so a minimal instance
// with two throwaway routes is enough to exercise them through real
// HTTP requests via inject() rather than hand-built request/reply
// mocks.
async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(fastifyCookie);
  await app.register(fastifyJwt, { secret: "fan-unlock-test-secret" });

  app.post<{ Params: { trackId: string; cardId: string } }>(
    "/grant/:trackId/:cardId",
    async (request, reply) => {
      await grantTrackUnlock(app, request, reply, request.params.trackId, request.params.cardId);
      return { ok: true };
    },
  );
  app.get<{ Params: { trackId: string }; Querystring: { active?: string } }>(
    "/check/:trackId",
    async (request) => {
      const activeCardIds = request.query.active?.split(",") ?? [];
      return {
        unlocked: isTrackUnlocked(request, request.params.trackId, activeCardIds),
        cardId: getUnlockCardId(request, request.params.trackId),
      };
    },
  );
  return app;
}

function extractCookie(setCookieHeader: string | string[] | undefined): string {
  const header = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  if (!header) throw new Error("no set-cookie header on response");
  const match = header.match(new RegExp(`${FAN_UNLOCK_COOKIE_NAME}=([^;]+)`));
  if (!match) throw new Error("fan-unlock cookie not present in Set-Cookie");
  return `${FAN_UNLOCK_COOKIE_NAME}=${match[1]}`;
}

describe("fan-unlock cookie", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("unlocks a track for a card that's still active", async () => {
    const grantRes = await app.inject({ method: "POST", url: "/grant/track-1/card-a" });
    const cookie = extractCookie(grantRes.headers["set-cookie"]);

    const checkRes = await app.inject({
      method: "GET",
      url: "/check/track-1?active=card-a,card-b",
      cookies: { [FAN_UNLOCK_COOKIE_NAME]: cookie.split("=")[1] },
    });
    expect(checkRes.json()).toEqual({ unlocked: true, cardId: "card-a" });
  });

  it("locks again once the redeemed card drops out of the active list (revoked)", async () => {
    const grantRes = await app.inject({ method: "POST", url: "/grant/track-1/card-a" });
    const cookie = extractCookie(grantRes.headers["set-cookie"]).split("=")[1];

    const checkRes = await app.inject({
      method: "GET",
      url: "/check/track-1?active=card-b", // card-a no longer active == revoked
      cookies: { [FAN_UNLOCK_COOKIE_NAME]: cookie },
    });
    // isTrackUnlocked re-checks against the caller's fresh active-card
    // list, so revocation locks it — but getUnlockCardId deliberately
    // doesn't take that list (see its comment in fan-unlock.ts); it
    // still reports which card the cookie claims, for the caller to
    // judge against its own freshly-loaded active set.
    expect(checkRes.json()).toEqual({ unlocked: false, cardId: "card-a" });
  });

  it("keeps unlocks for other tracks when a new track is granted", async () => {
    const first = await app.inject({ method: "POST", url: "/grant/track-1/card-a" });
    const cookie1 = extractCookie(first.headers["set-cookie"]).split("=")[1];

    const second = await app.inject({
      method: "POST",
      url: "/grant/track-2/card-b",
      cookies: { [FAN_UNLOCK_COOKIE_NAME]: cookie1 },
    });
    const cookie2 = extractCookie(second.headers["set-cookie"]).split("=")[1];

    const checkTrack1 = await app.inject({
      method: "GET",
      url: "/check/track-1?active=card-a",
      cookies: { [FAN_UNLOCK_COOKIE_NAME]: cookie2 },
    });
    const checkTrack2 = await app.inject({
      method: "GET",
      url: "/check/track-2?active=card-b",
      cookies: { [FAN_UNLOCK_COOKIE_NAME]: cookie2 },
    });
    expect(checkTrack1.json()).toEqual({ unlocked: true, cardId: "card-a" });
    expect(checkTrack2.json()).toEqual({ unlocked: true, cardId: "card-b" });
  });

  it("overwrites a track's unlock when granted again with a different card", async () => {
    const first = await app.inject({ method: "POST", url: "/grant/track-1/card-a" });
    const cookie1 = extractCookie(first.headers["set-cookie"]).split("=")[1];

    const regrant = await app.inject({
      method: "POST",
      url: "/grant/track-1/card-c",
      cookies: { [FAN_UNLOCK_COOKIE_NAME]: cookie1 },
    });
    const cookie2 = extractCookie(regrant.headers["set-cookie"]).split("=")[1];

    const check = await app.inject({
      method: "GET",
      url: "/check/track-1?active=card-a,card-c",
      cookies: { [FAN_UNLOCK_COOKIE_NAME]: cookie2 },
    });
    expect(check.json()).toEqual({ unlocked: true, cardId: "card-c" });
  });

  it("treats a missing or garbage cookie as locked, not an error", async () => {
    const noCookie = await app.inject({ method: "GET", url: "/check/track-1?active=card-a" });
    expect(noCookie.json()).toEqual({ unlocked: false, cardId: null });

    const garbage = await app.inject({
      method: "GET",
      url: "/check/track-1?active=card-a",
      cookies: { [FAN_UNLOCK_COOKIE_NAME]: "not-a-valid-jwt" },
    });
    expect(garbage.json()).toEqual({ unlocked: false, cardId: null });
  });
});
