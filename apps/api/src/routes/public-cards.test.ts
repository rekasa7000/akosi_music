import { randomUUID } from "node:crypto";
import { prisma } from "@akosi/database";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createPrivateTrackWithCard, deleteTrackFixture } from "../test/fixtures.js";

function uid(label: string): string {
  return `TEST-${label}-${randomUUID()}`;
}

describe("POST /cards/redeem", () => {
  let app: FastifyInstance;
  let cleanups: Array<() => Promise<void>> = [];

  // Fresh app per test: /cards/redeem is rate-limited to 5/min
  // in-process, and these tests must stay order-independent rather
  // than silently sharing (and exhausting) one quota across tests.
  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    while (cleanups.length) {
      await cleanups.pop()!();
    }
  });

  it("unlocks the track and sets the fan-unlock cookie for a valid, unclaimed card", async () => {
    const cardUid = uid("ok");
    const fixture = await createPrivateTrackWithCard({ cardUid });
    cleanups.push(() => deleteTrackFixture(fixture));

    const res = await app.inject({ method: "POST", url: "/cards/redeem", payload: { uid: cardUid } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: fixture.track.id,
      title: fixture.track.title,
      releaseId: fixture.release.id,
      artistName: fixture.artist.name,
    });
    expect(res.headers["set-cookie"]).toBeTruthy();
    expect(String(res.headers["set-cookie"])).toContain("akosi_fan_unlock=");
  });

  it("404s for a uid that doesn't exist", async () => {
    const res = await app.inject({ method: "POST", url: "/cards/redeem", payload: { uid: uid("missing") } });
    expect(res.statusCode).toBe(404);
  });

  it("404s for a revoked card even though the uid is real", async () => {
    const cardUid = uid("revoked");
    const fixture = await createPrivateTrackWithCard({ cardUid, cardStatus: "REVOKED" });
    cleanups.push(() => deleteTrackFixture(fixture));

    const res = await app.inject({ method: "POST", url: "/cards/redeem", payload: { uid: cardUid } });
    expect(res.statusCode).toBe(404);
  });

  it("404s when the card's track isn't READY yet", async () => {
    const cardUid = uid("processing");
    const fixture = await createPrivateTrackWithCard({ cardUid });
    await prisma.track.update({ where: { id: fixture.track.id }, data: { status: "PROCESSING" } });
    cleanups.push(() => deleteTrackFixture(fixture));

    const res = await app.inject({ method: "POST", url: "/cards/redeem", payload: { uid: cardUid } });
    expect(res.statusCode).toBe(404);
  });

  it("404s when the card's track has been soft-deleted", async () => {
    const cardUid = uid("deleted");
    const fixture = await createPrivateTrackWithCard({ cardUid });
    await prisma.track.update({ where: { id: fixture.track.id }, data: { deletedAt: new Date() } });
    cleanups.push(() => deleteTrackFixture(fixture));

    const res = await app.inject({ method: "POST", url: "/cards/redeem", payload: { uid: cardUid } });
    expect(res.statusCode).toBe(404);
  });

  it("validates the body — a missing uid is a 400, not a 404 or 500", async () => {
    const res = await app.inject({ method: "POST", url: "/cards/redeem", payload: {} });
    expect(res.statusCode).toBe(400);
  });
});
