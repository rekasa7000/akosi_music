import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { prisma } from "@akosi/database";
import { requireArtistSession } from "../auth/artist-session.js";
import {
  promoteRawUploadToMedia,
  keyMatchesPurpose,
  UploadNotFoundError,
  UploadTooLargeError,
  MEDIA_BUCKET,
  createPresignedPlaybackUrl,
} from "../storage.js";

const Track = Type.Object({
  id: Type.String(),
  title: Type.String(),
  trackNumber: Type.Union([Type.Integer(), Type.Null()]),
  mediaType: Type.String(),
  status: Type.String(),
  lyrics: Type.Union([Type.String(), Type.Null()]),
  coverImageKey: Type.Union([Type.String(), Type.Null()]),
});

const Release = Type.Object({
  id: Type.String(),
  title: Type.String(),
  releasedAt: Type.Union([Type.String(), Type.Null()]),
  coverImageKey: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

const ReleaseWithTracks = Type.Intersect([Release, Type.Object({ tracks: Type.Array(Track) })]);

const ReleaseSummary = Type.Intersect([
  Release,
  Type.Object({
    coverUrl: Type.Union([Type.String(), Type.Null()]),
    trackCount: Type.Integer(),
  }),
]);

const ErrorResponse = Type.Object({ error: Type.String() });

async function resolveCoverUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  return createPresignedPlaybackUrl({ bucket: MEDIA_BUCKET, key });
}

function serializeRelease(release: {
  id: string;
  title: string;
  releasedAt: Date | null;
  coverImageKey: string | null;
  createdAt: Date;
}) {
  return {
    id: release.id,
    title: release.title,
    releasedAt: release.releasedAt?.toISOString() ?? null,
    coverImageKey: release.coverImageKey,
    createdAt: release.createdAt.toISOString(),
  };
}

// Every route here resolves "my artist row" from the session's userId, not
// from anything the client sends — an artist can never name a different
// artistId and act on someone else's catalog.
async function requireOwnArtist(artistUserId: string | undefined) {
  if (!artistUserId) return null;
  return prisma.artist.findUnique({ where: { userId: artistUserId } });
}

export async function artistReleaseRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.post(
    "/artist/releases",
    {
      preHandler: requireArtistSession,
      schema: {
        body: Type.Object({
          title: Type.String({ minLength: 1, maxLength: 200 }),
          releasedAt: Type.Optional(Type.String({ format: "date-time" })),
        }),
        response: { 200: Release, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const artist = await requireOwnArtist(request.artistUserId);
      if (!artist) {
        return reply.code(404).send({ error: "Artist profile not found." });
      }
      const { title, releasedAt } = request.body;
      const release = await prisma.release.create({
        data: { artistId: artist.id, title, releasedAt: releasedAt ? new Date(releasedAt) : undefined },
      });
      return serializeRelease(release);
    },
  );

  typedApp.get(
    "/artist/releases",
    {
      preHandler: requireArtistSession,
      schema: { response: { 200: Type.Array(ReleaseSummary), 404: ErrorResponse } },
    },
    async (request, reply) => {
      const artist = await requireOwnArtist(request.artistUserId);
      if (!artist) {
        return reply.code(404).send({ error: "Artist profile not found." });
      }
      const releases = await prisma.release.findMany({
        where: { artistId: artist.id, deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { tracks: true } } },
      });
      return Promise.all(
        releases.map(async (release) => ({
          ...serializeRelease(release),
          coverUrl: await resolveCoverUrl(release.coverImageKey),
          trackCount: release._count.tracks,
        })),
      );
    },
  );

  typedApp.get(
    "/artist/releases/:id",
    {
      preHandler: requireArtistSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 200: ReleaseWithTracks, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const release = await prisma.release.findFirst({
        where: { id: request.params.id, artist: { userId: request.artistUserId }, deletedAt: null },
        include: { tracks: { where: { deletedAt: null }, orderBy: { trackNumber: "asc" } } },
      });
      if (!release) {
        return reply.code(404).send({ error: "Release not found." });
      }
      return {
        ...serializeRelease(release),
        tracks: release.tracks.map((track) => ({
          id: track.id,
          title: track.title,
          trackNumber: track.trackNumber,
          mediaType: track.mediaType,
          status: track.status,
          lyrics: track.lyrics,
          coverImageKey: track.coverImageKey,
        })),
      };
    },
  );

  typedApp.patch(
    "/artist/releases/:id",
    {
      preHandler: requireArtistSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          title: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
          releasedAt: Type.Optional(Type.String({ format: "date-time" })),
          coverImageKey: Type.Optional(Type.String()),
        }),
        response: { 200: Release, 400: ErrorResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const existing = await prisma.release.findFirst({
        where: { id: request.params.id, artist: { userId: request.artistUserId }, deletedAt: null },
      });
      if (!existing) {
        return reply.code(404).send({ error: "Release not found." });
      }

      const { title, releasedAt, coverImageKey } = request.body;
      const data: Parameters<typeof prisma.release.update>[0]["data"] = {};

      if (title !== undefined) data.title = title;
      if (releasedAt !== undefined) data.releasedAt = new Date(releasedAt);

      if (coverImageKey !== undefined) {
        if (!keyMatchesPurpose(coverImageKey, "release-cover")) {
          return reply.code(400).send({ error: "coverImageKey doesn't look like a presigned release-cover upload." });
        }
        try {
          await promoteRawUploadToMedia(coverImageKey, "release-cover");
        } catch (err) {
          if (err instanceof UploadNotFoundError || err instanceof UploadTooLargeError) {
            return reply.code(400).send({ error: err.message });
          }
          throw err;
        }
        data.coverImageKey = coverImageKey;
      }

      const release = await prisma.release.update({ where: { id: existing.id }, data });
      return serializeRelease(release);
    },
  );
}
