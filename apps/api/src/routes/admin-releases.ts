import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { prisma } from "@akosi/database";
import { requireAdminSession } from "../auth/session.js";
import { promoteRawUploadToMedia, keyMatchesPurpose, UploadNotFoundError } from "../storage.js";

const Track = Type.Object({
  id: Type.String(),
  title: Type.String(),
  trackNumber: Type.Union([Type.Integer(), Type.Null()]),
  mediaType: Type.String(),
  status: Type.String(),
  coverImageKey: Type.Union([Type.String(), Type.Null()]),
  cardCount: Type.Integer(),
  locked: Type.Boolean(),
});

const Release = Type.Object({
  id: Type.String(),
  artistId: Type.String(),
  title: Type.String(),
  releasedAt: Type.Union([Type.String(), Type.Null()]),
  coverImageKey: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

const ReleaseWithTracks = Type.Intersect([Release, Type.Object({ tracks: Type.Array(Track) })]);

const ErrorResponse = Type.Object({ error: Type.String() });

function serializeRelease(release: {
  id: string;
  artistId: string;
  title: string;
  releasedAt: Date | null;
  coverImageKey: string | null;
  createdAt: Date;
}) {
  return {
    id: release.id,
    artistId: release.artistId,
    title: release.title,
    releasedAt: release.releasedAt?.toISOString() ?? null,
    coverImageKey: release.coverImageKey,
    createdAt: release.createdAt.toISOString(),
  };
}

export async function adminReleaseRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.post(
    "/admin/releases",
    {
      preHandler: requireAdminSession,
      schema: {
        body: Type.Object({
          artistId: Type.String(),
          title: Type.String({ minLength: 1, maxLength: 200 }),
          releasedAt: Type.Optional(Type.String({ format: "date-time" })),
        }),
        response: { 200: Release, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const { artistId, title, releasedAt } = request.body;
      const artist = await prisma.artist.findUnique({ where: { id: artistId } });
      if (!artist) {
        return reply.code(404).send({ error: "Artist not found." });
      }
      const release = await prisma.release.create({
        data: { artistId, title, releasedAt: releasedAt ? new Date(releasedAt) : undefined },
      });
      return serializeRelease(release);
    },
  );

  typedApp.get(
    "/admin/releases",
    {
      preHandler: requireAdminSession,
      schema: { response: { 200: Type.Array(Release) } },
    },
    async () => {
      const releases = await prisma.release.findMany({ orderBy: { createdAt: "desc" } });
      return releases.map(serializeRelease);
    },
  );

  typedApp.get(
    "/admin/releases/:id",
    {
      preHandler: requireAdminSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 200: ReleaseWithTracks, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const release = await prisma.release.findUnique({
        where: { id: request.params.id },
        include: {
          tracks: { include: { cards: true }, orderBy: { trackNumber: "asc" } },
        },
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
          coverImageKey: track.coverImageKey,
          // Active (redeemable) card count, not the same as "locked":
          // a track with only revoked cards stays locked but shows 0
          // here, signaling "needs a new card," not "is public."
          cardCount: track.cards.filter((c) => c.status !== "REVOKED").length,
          locked: track.cards.length > 0,
        })),
      };
    },
  );

  typedApp.patch(
    "/admin/releases/:id",
    {
      preHandler: requireAdminSession,
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
      const existing = await prisma.release.findUnique({ where: { id: request.params.id } });
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
          await promoteRawUploadToMedia(coverImageKey);
        } catch (err) {
          if (err instanceof UploadNotFoundError) {
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
