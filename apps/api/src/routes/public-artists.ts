import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { prisma } from "@akosi/database";
import { MEDIA_BUCKET, createPresignedPlaybackUrl } from "../storage.js";

const ArtistSummary = Type.Object({
  slug: Type.String(),
  name: Type.String(),
  bio: Type.Union([Type.String(), Type.Null()]),
  profileImageUrl: Type.Union([Type.String(), Type.Null()]),
  coverImageUrl: Type.Union([Type.String(), Type.Null()]),
  releaseCount: Type.Integer(),
});

const ArtistReleaseSummary = Type.Object({
  id: Type.String(),
  title: Type.String(),
  releasedAt: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  trackCount: Type.Integer(),
});

const ArtistDetail = Type.Object({
  slug: Type.String(),
  name: Type.String(),
  bio: Type.Union([Type.String(), Type.Null()]),
  profileImageUrl: Type.Union([Type.String(), Type.Null()]),
  coverImageUrl: Type.Union([Type.String(), Type.Null()]),
  websiteUrl: Type.Union([Type.String(), Type.Null()]),
  instagramUrl: Type.Union([Type.String(), Type.Null()]),
  twitterUrl: Type.Union([Type.String(), Type.Null()]),
  releases: Type.Array(ArtistReleaseSummary),
});

const ErrorResponse = Type.Object({ error: Type.String() });

async function resolveUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  return createPresignedPlaybackUrl({ bucket: MEDIA_BUCKET, key });
}

export async function publicArtistRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  // Only artists with at least one release carrying a READY track are
  // worth surfacing publicly — an artist profile the admin created but
  // hasn't uploaded anything for yet would otherwise show up as a dead
  // end in the directory.
  typedApp.get(
    "/artists",
    {
      schema: { response: { 200: Type.Array(ArtistSummary) } },
    },
    async () => {
      const artists = await prisma.artist.findMany({
        where: { deletedAt: null },
        include: {
          releases: { where: { deletedAt: null }, include: { _count: { select: { tracks: true } } } },
        },
        orderBy: { name: "asc" },
      });

      const withReadyTracks = await prisma.track.groupBy({
        by: ["releaseId"],
        where: { status: "READY", deletedAt: null },
      });
      const releaseIdsWithReadyTracks = new Set(withReadyTracks.map((t) => t.releaseId));

      const results = await Promise.all(
        artists
          .map((artist) => ({
            artist,
            releaseCount: artist.releases.filter((r) => releaseIdsWithReadyTracks.has(r.id)).length,
          }))
          .filter(({ releaseCount }) => releaseCount > 0)
          .map(async ({ artist, releaseCount }) => ({
            slug: artist.slug,
            name: artist.name,
            bio: artist.bio,
            profileImageUrl: await resolveUrl(artist.profileImageKey),
            coverImageUrl: await resolveUrl(artist.coverImageKey),
            releaseCount,
          })),
      );

      return results;
    },
  );

  typedApp.get(
    "/artists/:slug",
    {
      schema: {
        params: Type.Object({ slug: Type.String() }),
        response: { 200: ArtistDetail, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const artist = await prisma.artist.findFirst({
        where: { slug: request.params.slug, deletedAt: null },
        include: {
          releases: {
            where: { deletedAt: null },
            include: { _count: { select: { tracks: { where: { status: "READY", deletedAt: null } } } } },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      const releasesWithTracks = artist?.releases.filter((r) => r._count.tracks > 0) ?? [];

      // Same publication gate as GET /artists — an artist with nothing
      // READY yet isn't meant to be reachable publicly, not even by
      // someone who already has/guesses the slug (e.g. from the admin
      // UI, which uses the same slugs). Identical 404 either way, so
      // this doesn't distinguish "unpublished" from "doesn't exist."
      if (!artist || releasesWithTracks.length === 0) {
        return reply.code(404).send({ error: "Artist not found." });
      }

      return {
        slug: artist.slug,
        name: artist.name,
        bio: artist.bio,
        profileImageUrl: await resolveUrl(artist.profileImageKey),
        coverImageUrl: await resolveUrl(artist.coverImageKey),
        websiteUrl: artist.websiteUrl,
        instagramUrl: artist.instagramUrl,
        twitterUrl: artist.twitterUrl,
        releases: await Promise.all(
          releasesWithTracks.map(async (release) => ({
            id: release.id,
            title: release.title,
            releasedAt: release.releasedAt?.toISOString() ?? null,
            coverUrl: await resolveUrl(release.coverImageKey),
            trackCount: release._count.tracks,
          })),
        ),
      };
    },
  );
}
