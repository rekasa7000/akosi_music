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
import type { MediaUploadPurpose } from "../storage.js";

const MediaType = Type.Union([Type.Literal("AUDIO"), Type.Literal("VIDEO")]);

const TrackDetail = Type.Object({
  id: Type.String(),
  releaseId: Type.String(),
  title: Type.String(),
  trackNumber: Type.Union([Type.Integer(), Type.Null()]),
  durationSec: Type.Union([Type.Integer(), Type.Null()]),
  mediaType: MediaType,
  lyrics: Type.Union([Type.String(), Type.Null()]),
  coverImageKey: Type.Union([Type.String(), Type.Null()]),
  status: Type.String(),
  createdAt: Type.String(),
});

const PlayResponse = Type.Object({
  url: Type.String(),
  mediaType: MediaType,
  title: Type.String(),
  artistName: Type.String(),
  releaseTitle: Type.String(),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  lyrics: Type.Union([Type.String(), Type.Null()]),
});

const ErrorResponse = Type.Object({ error: Type.String() });

function serializeTrack(track: {
  id: string;
  releaseId: string;
  title: string;
  trackNumber: number | null;
  durationSec: number | null;
  mediaType: string;
  lyrics: string | null;
  coverImageKey: string | null;
  status: string;
  createdAt: Date;
}) {
  return {
    id: track.id,
    releaseId: track.releaseId,
    title: track.title,
    trackNumber: track.trackNumber,
    durationSec: track.durationSec,
    mediaType: track.mediaType as "AUDIO" | "VIDEO",
    lyrics: track.lyrics,
    coverImageKey: track.coverImageKey,
    status: track.status,
    createdAt: track.createdAt.toISOString(),
  };
}

function mediaPurposeFor(mediaType: "AUDIO" | "VIDEO"): MediaUploadPurpose {
  return mediaType === "AUDIO" ? "track-audio" : "track-video";
}

export async function artistTrackRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  // Ownership-scoped preview — lets an artist confirm an upload actually
  // works before any card exists to gate it for real. No PlayEvent is
  // recorded, same as admin's equivalent preview route.
  typedApp.get(
    "/artist/tracks/:id/play",
    {
      preHandler: requireArtistSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 200: PlayResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const track = await prisma.track.findFirst({
        where: { id: request.params.id, release: { artist: { userId: request.artistUserId } }, deletedAt: null },
        include: { release: { include: { artist: true } } },
      });
      if (!track || track.status !== "READY") {
        return reply.code(404).send({ error: "Track not found." });
      }

      const key = track.processedStorageKey ?? track.rawStorageKey;
      if (!key) {
        return reply.code(404).send({ error: "Track not found." });
      }

      const url = await createPresignedPlaybackUrl({ bucket: MEDIA_BUCKET, key });
      const coverKey = track.coverImageKey ?? track.release.coverImageKey;
      const coverUrl = coverKey ? await createPresignedPlaybackUrl({ bucket: MEDIA_BUCKET, key: coverKey }) : null;

      return {
        url,
        mediaType: track.mediaType as "AUDIO" | "VIDEO",
        title: track.title,
        artistName: track.release.artist.name,
        releaseTitle: track.release.title,
        coverUrl,
        lyrics: track.lyrics,
      };
    },
  );

  typedApp.post(
    "/artist/releases/:releaseId/tracks",
    {
      preHandler: requireArtistSession,
      schema: {
        params: Type.Object({ releaseId: Type.String() }),
        body: Type.Object({
          title: Type.String({ minLength: 1, maxLength: 200 }),
          mediaType: MediaType,
          rawStorageKey: Type.String({ minLength: 1 }),
          trackNumber: Type.Optional(Type.Integer({ minimum: 1 })),
          durationSec: Type.Optional(Type.Integer({ minimum: 0 })),
          lyrics: Type.Optional(Type.String({ maxLength: 20000 })),
          coverImageKey: Type.Optional(Type.String()),
        }),
        response: { 200: TrackDetail, 400: ErrorResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const { releaseId } = request.params;
      const { title, mediaType, rawStorageKey, trackNumber, durationSec, lyrics, coverImageKey } =
        request.body;

      const release = await prisma.release.findFirst({
        where: { id: releaseId, artist: { userId: request.artistUserId }, deletedAt: null },
      });
      if (!release) {
        return reply.code(404).send({ error: "Release not found." });
      }

      if (!keyMatchesPurpose(rawStorageKey, mediaPurposeFor(mediaType))) {
        return reply.code(400).send({
          error: `rawStorageKey doesn't look like a presigned ${mediaPurposeFor(mediaType)} upload.`,
        });
      }
      if (coverImageKey !== undefined && !keyMatchesPurpose(coverImageKey, "track-cover")) {
        return reply.code(400).send({ error: "coverImageKey doesn't look like a presigned track-cover upload." });
      }

      try {
        await promoteRawUploadToMedia(rawStorageKey, mediaPurposeFor(mediaType));
        if (coverImageKey !== undefined) {
          await promoteRawUploadToMedia(coverImageKey, "track-cover");
        }
      } catch (err) {
        if (err instanceof UploadNotFoundError || err instanceof UploadTooLargeError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }

      // No transcode worker yet — same Phase 0 shortcut as admin uploads
      // (see docs/11-mvp-phase0.md): the promoted copy is served as-is.
      const track = await prisma.track.create({
        data: {
          releaseId,
          title,
          mediaType,
          trackNumber,
          durationSec,
          lyrics,
          coverImageKey,
          rawStorageKey,
          processedStorageKey: rawStorageKey,
          status: "READY",
        },
      });
      return serializeTrack(track);
    },
  );

  typedApp.patch(
    "/artist/tracks/:id",
    {
      preHandler: requireArtistSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          title: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
          trackNumber: Type.Optional(Type.Integer({ minimum: 1 })),
          lyrics: Type.Optional(Type.String({ maxLength: 20000 })),
          coverImageKey: Type.Optional(Type.String()),
        }),
        response: { 200: TrackDetail, 400: ErrorResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const existing = await prisma.track.findFirst({
        where: { id: request.params.id, release: { artist: { userId: request.artistUserId } }, deletedAt: null },
      });
      if (!existing) {
        return reply.code(404).send({ error: "Track not found." });
      }

      const { title, trackNumber, lyrics, coverImageKey } = request.body;
      const data: Parameters<typeof prisma.track.update>[0]["data"] = {};
      if (title !== undefined) data.title = title;
      if (trackNumber !== undefined) data.trackNumber = trackNumber;
      if (lyrics !== undefined) data.lyrics = lyrics;

      if (coverImageKey !== undefined) {
        if (!keyMatchesPurpose(coverImageKey, "track-cover")) {
          return reply.code(400).send({ error: "coverImageKey doesn't look like a presigned track-cover upload." });
        }
        try {
          await promoteRawUploadToMedia(coverImageKey, "track-cover");
        } catch (err) {
          if (err instanceof UploadNotFoundError || err instanceof UploadTooLargeError) {
            return reply.code(400).send({ error: err.message });
          }
          throw err;
        }
        data.coverImageKey = coverImageKey;
      }

      const track = await prisma.track.update({ where: { id: existing.id }, data });
      return serializeTrack(track);
    },
  );
}
