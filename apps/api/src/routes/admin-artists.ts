import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Prisma, prisma } from "@akosi/database";
import { requireAdminSession } from "../auth/session.js";
import {
  promoteRawUploadToMedia,
  keyMatchesPurpose,
  UploadNotFoundError,
  MEDIA_BUCKET,
  createPresignedPlaybackUrl,
} from "../storage.js";

const Artist = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  bio: Type.Union([Type.String(), Type.Null()]),
  profileImageUrl: Type.Union([Type.String(), Type.Null()]),
  coverImageUrl: Type.Union([Type.String(), Type.Null()]),
  websiteUrl: Type.Union([Type.String(), Type.Null()]),
  instagramUrl: Type.Union([Type.String(), Type.Null()]),
  twitterUrl: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

const ErrorResponse = Type.Object({ error: Type.String() });

// A-z, 0-9, single hyphens between segments — matches how the slug
// shows up in a URL later (docs/09-data-model.md: Artist.slug unique).
const SLUG_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$";

async function resolveImageUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  return createPresignedPlaybackUrl({ bucket: MEDIA_BUCKET, key });
}

async function serializeArtist(artist: {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  profileImageKey: string | null;
  coverImageKey: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  createdAt: Date;
}) {
  return {
    id: artist.id,
    name: artist.name,
    slug: artist.slug,
    bio: artist.bio,
    profileImageUrl: await resolveImageUrl(artist.profileImageKey),
    coverImageUrl: await resolveImageUrl(artist.coverImageKey),
    websiteUrl: artist.websiteUrl,
    instagramUrl: artist.instagramUrl,
    twitterUrl: artist.twitterUrl,
    createdAt: artist.createdAt.toISOString(),
  };
}

const ArtistWithCounts = Type.Intersect([
  Artist,
  Type.Object({ releaseCount: Type.Integer(), trackCount: Type.Integer() }),
]);

const ArtistTrack = Type.Object({
  id: Type.String(),
  title: Type.String(),
  trackNumber: Type.Union([Type.Integer(), Type.Null()]),
  mediaType: Type.Union([Type.Literal("AUDIO"), Type.Literal("VIDEO")]),
  status: Type.String(),
  playCount: Type.Integer(),
  cardCount: Type.Integer(),
  locked: Type.Boolean(),
});

const ArtistRelease = Type.Object({
  id: Type.String(),
  title: Type.String(),
  releasedAt: Type.Union([Type.String(), Type.Null()]),
  tracks: Type.Array(ArtistTrack),
});

const ArtistDetail = Type.Intersect([
  Artist,
  Type.Object({
    totalPlays: Type.Integer(),
    releaseCount: Type.Integer(),
    trackCount: Type.Integer(),
    releases: Type.Array(ArtistRelease),
  }),
]);

// Website/social fields end up as the href of a real link once a
// profile page renders them — format: "uri" alone accepts
// javascript:/data:/vbscript: URIs too (syntactically valid URIs,
// but executable if ever rendered as <a href={value}>), so nothing
// but http(s) is accepted at the point of storage. Relying on every
// future renderer to re-check the scheme would just be waiting for
// one to forget.
const UrlField = Type.String({ pattern: "^https?://", maxLength: 300 });

export async function adminArtistRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.post(
    "/admin/artists",
    {
      preHandler: requireAdminSession,
      schema: {
        body: Type.Object({
          name: Type.String({ minLength: 1, maxLength: 200 }),
          slug: Type.String({ pattern: SLUG_PATTERN, maxLength: 100 }),
          bio: Type.Optional(Type.String({ maxLength: 2000 })),
        }),
        response: { 200: Artist, 409: ErrorResponse },
      },
    },
    async (request, reply) => {
      const { name, slug, bio } = request.body;
      try {
        const artist = await prisma.artist.create({ data: { name, slug, bio } });
        return serializeArtist(artist);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return reply.code(409).send({ error: "An artist with that slug already exists." });
        }
        throw err;
      }
    },
  );

  typedApp.get(
    "/admin/artists",
    {
      preHandler: requireAdminSession,
      schema: {
        response: { 200: Type.Array(ArtistWithCounts) },
      },
    },
    async () => {
      const artists = await prisma.artist.findMany({
        orderBy: { createdAt: "desc" },
        include: { releases: { select: { _count: { select: { tracks: true } } } } },
      });
      return Promise.all(
        artists.map(async (artist) => ({
          ...(await serializeArtist(artist)),
          releaseCount: artist.releases.length,
          trackCount: artist.releases.reduce((sum, r) => sum + r._count.tracks, 0),
        })),
      );
    },
  );

  typedApp.get(
    "/admin/artists/:id",
    {
      preHandler: requireAdminSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 200: ArtistDetail, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const artist = await prisma.artist.findUnique({
        where: { id: request.params.id },
        include: { releases: { include: { tracks: true }, orderBy: { createdAt: "desc" } } },
      });
      if (!artist) {
        return reply.code(404).send({ error: "Artist not found." });
      }

      const trackIds = artist.releases.flatMap((r) => r.tracks.map((t) => t.id));
      const [playCounts, activeCardCounts, everCardCounts] = await Promise.all([
        prisma.playEvent.groupBy({ by: ["trackId"], where: { trackId: { in: trackIds } }, _count: true }),
        prisma.card.groupBy({
          by: ["trackId"],
          where: { trackId: { in: trackIds }, status: { not: "REVOKED" } },
          _count: true,
        }),
        // "Locked" tracks ever having had a card, not currently having
        // an active one — a track with only revoked cards stays
        // locked (just unredeemable until a new card exists).
        prisma.card.groupBy({ by: ["trackId"], where: { trackId: { in: trackIds } }, _count: true }),
      ]);
      const playCountByTrack = new Map(playCounts.map((p) => [p.trackId, p._count]));
      const cardCountByTrack = new Map(activeCardCounts.map((c) => [c.trackId!, c._count]));
      const everHadCardTrackIds = new Set(everCardCounts.map((c) => c.trackId!));
      const totalPlays = playCounts.reduce((sum, p) => sum + p._count, 0);

      return {
        ...(await serializeArtist(artist)),
        totalPlays,
        releaseCount: artist.releases.length,
        trackCount: trackIds.length,
        releases: artist.releases.map((release) => ({
          id: release.id,
          title: release.title,
          releasedAt: release.releasedAt?.toISOString() ?? null,
          tracks: release.tracks.map((track) => ({
            id: track.id,
            title: track.title,
            trackNumber: track.trackNumber,
            mediaType: track.mediaType as "AUDIO" | "VIDEO",
            status: track.status,
            playCount: playCountByTrack.get(track.id) ?? 0,
            cardCount: cardCountByTrack.get(track.id) ?? 0,
            locked: everHadCardTrackIds.has(track.id),
          })),
        })),
      };
    },
  );

  typedApp.patch(
    "/admin/artists/:id",
    {
      preHandler: requireAdminSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          bio: Type.Optional(Type.String({ maxLength: 2000 })),
          websiteUrl: Type.Optional(Type.Union([UrlField, Type.Null()])),
          instagramUrl: Type.Optional(Type.Union([UrlField, Type.Null()])),
          twitterUrl: Type.Optional(Type.Union([UrlField, Type.Null()])),
          profileImageKey: Type.Optional(Type.String()),
          coverImageKey: Type.Optional(Type.String()),
        }),
        response: { 200: Artist, 400: ErrorResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const existing = await prisma.artist.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.code(404).send({ error: "Artist not found." });
      }

      const { bio, websiteUrl, instagramUrl, twitterUrl, profileImageKey, coverImageKey } = request.body;
      const data: Parameters<typeof prisma.artist.update>[0]["data"] = {};

      if (bio !== undefined) data.bio = bio;
      if (websiteUrl !== undefined) data.websiteUrl = websiteUrl;
      if (instagramUrl !== undefined) data.instagramUrl = instagramUrl;
      if (twitterUrl !== undefined) data.twitterUrl = twitterUrl;

      for (const [key, purpose] of [
        [profileImageKey, "artist-profile"],
        [coverImageKey, "artist-cover"],
      ] as const) {
        if (key === undefined) continue;
        if (!keyMatchesPurpose(key, purpose)) {
          return reply.code(400).send({ error: `This doesn't look like a presigned ${purpose} upload.` });
        }
        try {
          await promoteRawUploadToMedia(key);
        } catch (err) {
          if (err instanceof UploadNotFoundError) {
            return reply.code(400).send({ error: err.message });
          }
          throw err;
        }
      }
      if (profileImageKey !== undefined) data.profileImageKey = profileImageKey;
      if (coverImageKey !== undefined) data.coverImageKey = coverImageKey;

      const artist = await prisma.artist.update({ where: { id: existing.id }, data });
      return serializeArtist(artist);
    },
  );
}
