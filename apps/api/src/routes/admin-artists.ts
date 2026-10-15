import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Prisma, prisma } from "@akosi/database";
import { requireAdminSession } from "../auth/session.js";

const Artist = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  bio: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

const ErrorResponse = Type.Object({ error: Type.String() });

// A-z, 0-9, single hyphens between segments — matches how the slug
// shows up in a URL later (docs/09-data-model.md: Artist.slug unique).
const SLUG_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$";

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

const ArtistDetail = Type.Intersect([Artist, Type.Object({ releases: Type.Array(ArtistRelease) })]);

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
        return { ...artist, createdAt: artist.createdAt.toISOString() };
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
        response: { 200: Type.Array(Artist) },
      },
    },
    async () => {
      const artists = await prisma.artist.findMany({ orderBy: { createdAt: "desc" } });
      return artists.map((artist) => ({ ...artist, createdAt: artist.createdAt.toISOString() }));
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

      return {
        id: artist.id,
        name: artist.name,
        slug: artist.slug,
        bio: artist.bio,
        createdAt: artist.createdAt.toISOString(),
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
}
