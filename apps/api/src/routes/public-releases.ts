import { verify as verifyPasswordHash } from "argon2";
import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type, type Static } from "typebox";
import { prisma } from "@akosi/database";
import type { Prisma } from "@akosi/database";
import { getUnlockedReleaseIds, grantReleaseUnlock } from "../auth/fan-unlock.js";
import { MEDIA_BUCKET, createPresignedPlaybackUrl } from "../storage.js";

const MediaType = Type.Union([Type.Literal("AUDIO"), Type.Literal("VIDEO")]);

const PublicTrack = Type.Object({
  id: Type.String(),
  title: Type.String(),
  trackNumber: Type.Union([Type.Integer(), Type.Null()]),
  durationSec: Type.Union([Type.Integer(), Type.Null()]),
  mediaType: MediaType,
  lyrics: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
});

const PublicRelease = Type.Object({
  id: Type.String(),
  title: Type.String(),
  artistName: Type.String(),
  releasedAt: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  visibility: Type.Union([Type.Literal("PUBLIC"), Type.Literal("PRIVATE")]),
  locked: Type.Boolean(),
  tracks: Type.Optional(Type.Array(PublicTrack)),
});

const ErrorResponse = Type.Object({ error: Type.String() });

type ReleaseWithTracks = Prisma.ReleaseGetPayload<{
  include: { artist: true; tracks: true };
}>;

async function resolveCoverUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  return createPresignedPlaybackUrl({ bucket: MEDIA_BUCKET, key });
}

async function serializeTrack(
  track: ReleaseWithTracks["tracks"][number],
  releaseCoverKey: string | null,
): Promise<Static<typeof PublicTrack>> {
  return {
    id: track.id,
    title: track.title,
    trackNumber: track.trackNumber,
    durationSec: track.durationSec,
    mediaType: track.mediaType as "AUDIO" | "VIDEO",
    lyrics: track.lyrics,
    coverUrl: await resolveCoverUrl(track.coverImageKey ?? releaseCoverKey),
  };
}

async function serializeRelease(
  release: ReleaseWithTracks,
  locked: boolean,
): Promise<Static<typeof PublicRelease>> {
  const base = {
    id: release.id,
    title: release.title,
    artistName: release.artist.name,
    releasedAt: release.releasedAt?.toISOString() ?? null,
    coverUrl: await resolveCoverUrl(release.coverImageKey),
    visibility: release.visibility as "PUBLIC" | "PRIVATE",
  };

  if (locked) {
    return { ...base, locked: true };
  }

  const readyTracks = release.tracks
    .filter((t) => t.status === "READY")
    .sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
  const tracks = await Promise.all(
    readyTracks.map((t) => serializeTrack(t, release.coverImageKey)),
  );
  return { ...base, locked: false, tracks };
}

export async function publicReleaseRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.get(
    "/releases/:id",
    {
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 200: PublicRelease, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const release = await prisma.release.findUnique({
        where: { id: request.params.id },
        include: { artist: true, tracks: true },
      });
      if (!release) {
        return reply.code(404).send({ error: "Release not found." });
      }

      const locked =
        release.visibility === "PRIVATE" &&
        !getUnlockedReleaseIds(request).includes(release.id);
      return serializeRelease(release, locked);
    },
  );

  typedApp.post(
    "/releases/:id/unlock",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({ password: Type.String({ minLength: 1 }) }),
        response: { 200: PublicRelease, 401: ErrorResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const release = await prisma.release.findUnique({
        where: { id: request.params.id },
        include: { artist: true, tracks: true },
      });
      if (!release) {
        return reply.code(404).send({ error: "Release not found." });
      }

      const passwordOk =
        release.passwordHash != null &&
        (await verifyPasswordHash(release.passwordHash, request.body.password));
      if (!passwordOk) {
        return reply.code(401).send({ error: "Incorrect password." });
      }

      await grantReleaseUnlock(app, request, reply, release.id);
      return serializeRelease(release, false);
    },
  );
}
