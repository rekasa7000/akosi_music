import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type, type Static } from "typebox";
import { prisma } from "@akosi/database";
import type { Prisma } from "@akosi/database";
import { isTrackUnlocked } from "../auth/fan-unlock.js";
import { MEDIA_BUCKET, createPresignedPlaybackUrl } from "../storage.js";

const MediaType = Type.Union([Type.Literal("AUDIO"), Type.Literal("VIDEO")]);

// Locked tracks only ever expose title/trackNumber/mediaType — no
// lyrics, no cover, no hint of anything else until a valid card is
// redeemed for that specific track.
const PublicTrack = Type.Object({
  id: Type.String(),
  title: Type.String(),
  trackNumber: Type.Union([Type.Integer(), Type.Null()]),
  durationSec: Type.Union([Type.Integer(), Type.Null()]),
  mediaType: MediaType,
  locked: Type.Boolean(),
  lyrics: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
});

const PublicArtistInfo = Type.Object({
  name: Type.String(),
  bio: Type.Union([Type.String(), Type.Null()]),
  profileImageUrl: Type.Union([Type.String(), Type.Null()]),
  facebookUrl: Type.Union([Type.String(), Type.Null()]),
  instagramUrl: Type.Union([Type.String(), Type.Null()]),
  spotifyUrl: Type.Union([Type.String(), Type.Null()]),
});

const PublicRelease = Type.Object({
  id: Type.String(),
  title: Type.String(),
  // Kept alongside the richer `artist` object below — existing
  // consumers (the plain /r/[id] release page) only need the name.
  artistName: Type.String(),
  releasedAt: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  artist: PublicArtistInfo,
  tracks: Type.Array(PublicTrack),
});

const ErrorResponse = Type.Object({ error: Type.String() });

type ReleaseWithTracks = Prisma.ReleaseGetPayload<{
  include: { artist: true; tracks: { include: { cards: true } } };
}>;

async function resolveCoverUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  return createPresignedPlaybackUrl({ bucket: MEDIA_BUCKET, key });
}

async function serializeTrack(
  request: Parameters<typeof isTrackUnlocked>[0],
  track: ReleaseWithTracks["tracks"][number],
  releaseCoverKey: string | null,
): Promise<Static<typeof PublicTrack>> {
  const activeCardIds = track.cards.filter((c) => c.status !== "REVOKED").map((c) => c.id);
  // Every track is locked until this browser redeems a card for it —
  // there is no public tier, and a track whose only card was revoked
  // stays locked (unredeemable until a new card exists) rather than
  // falling back to public.
  const locked = !isTrackUnlocked(request, track.id, activeCardIds);

  if (locked) {
    return {
      id: track.id,
      title: track.title,
      trackNumber: track.trackNumber,
      durationSec: null,
      mediaType: track.mediaType as "AUDIO" | "VIDEO",
      locked: true,
      lyrics: null,
      coverUrl: null,
    };
  }

  return {
    id: track.id,
    title: track.title,
    trackNumber: track.trackNumber,
    durationSec: track.durationSec,
    mediaType: track.mediaType as "AUDIO" | "VIDEO",
    locked: false,
    lyrics: track.lyrics,
    coverUrl: await resolveCoverUrl(track.coverImageKey ?? releaseCoverKey),
  };
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
        include: { artist: true, tracks: { include: { cards: true } } },
      });
      if (!release || release.deletedAt || release.artist.deletedAt) {
        return reply.code(404).send({ error: "Release not found." });
      }

      const readyTracks = release.tracks
        .filter((t) => t.status === "READY" && !t.deletedAt)
        .sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
      const tracks = await Promise.all(
        readyTracks.map((t) => serializeTrack(request, t, release.coverImageKey)),
      );

      return {
        id: release.id,
        title: release.title,
        artistName: release.artist.name,
        releasedAt: release.releasedAt?.toISOString() ?? null,
        coverUrl: await resolveCoverUrl(release.coverImageKey),
        artist: {
          name: release.artist.name,
          bio: release.artist.bio,
          profileImageUrl: await resolveCoverUrl(release.artist.profileImageKey),
          facebookUrl: release.artist.facebookUrl,
          instagramUrl: release.artist.instagramUrl,
          spotifyUrl: release.artist.spotifyUrl,
        },
        tracks,
      };
    },
  );
}
