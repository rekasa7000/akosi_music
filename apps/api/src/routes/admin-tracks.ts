import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { prisma } from "@akosi/database";
import { requireAdminSession } from "../auth/session.js";
import {
  promoteRawUploadToMedia,
  keyMatchesPurpose,
  UploadNotFoundError,
  MEDIA_BUCKET,
  createPresignedPlaybackUrl,
  type MediaUploadPurpose,
} from "../storage.js";

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

const TrackPickerEntry = Type.Object({
  id: Type.String(),
  title: Type.String(),
  releaseTitle: Type.String(),
  artistName: Type.String(),
  mediaType: MediaType,
});

const PlayResponse = Type.Object({
  url: Type.String(),
  mediaType: MediaType,
});

export async function adminTrackRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  // Flat cross-artist list for pickers (the "assign a card to a
  // track" flow) — everything else exposes tracks nested under a
  // release or artist, which is awkward for "search across
  // everything."
  typedApp.get(
    "/admin/tracks",
    {
      preHandler: requireAdminSession,
      schema: { response: { 200: Type.Array(TrackPickerEntry) } },
    },
    async () => {
      const tracks = await prisma.track.findMany({
        where: { status: "READY" },
        include: { release: { include: { artist: true } } },
        orderBy: { createdAt: "desc" },
      });
      return tracks.map((t) => ({
        id: t.id,
        title: t.title,
        releaseTitle: t.release.title,
        artistName: t.release.artist.name,
        mediaType: t.mediaType as "AUDIO" | "VIDEO",
      }));
    },
  );

  // Admin playback bypasses the fan card-unlock gate entirely — an
  // authenticated admin can preview any track regardless of lock
  // status. No PlayEvent is recorded, so admin previews don't skew
  // fan-facing play counts.
  typedApp.get(
    "/admin/tracks/:id/play",
    {
      preHandler: requireAdminSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 200: PlayResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const track = await prisma.track.findUnique({ where: { id: request.params.id } });
      if (!track || track.status !== "READY") {
        return reply.code(404).send({ error: "Track not found." });
      }

      const key = track.processedStorageKey ?? track.rawStorageKey;
      if (!key) {
        return reply.code(404).send({ error: "Track not found." });
      }

      const url = await createPresignedPlaybackUrl({ bucket: MEDIA_BUCKET, key });
      return { url, mediaType: track.mediaType as "AUDIO" | "VIDEO" };
    },
  );

  typedApp.post(
    "/admin/releases/:releaseId/tracks",
    {
      preHandler: requireAdminSession,
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

      const release = await prisma.release.findUnique({ where: { id: releaseId } });
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
        await promoteRawUploadToMedia(rawStorageKey);
        if (coverImageKey !== undefined) {
          await promoteRawUploadToMedia(coverImageKey);
        }
      } catch (err) {
        if (err instanceof UploadNotFoundError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }

      // No transcode worker yet (apps/worker is still a placeholder) —
      // the promoted copy in the media bucket is served as-is. See
      // docs/11-mvp-phase0.md.
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
    "/admin/tracks/:id",
    {
      preHandler: requireAdminSession,
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
      const existing = await prisma.track.findUnique({ where: { id: request.params.id } });
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
          await promoteRawUploadToMedia(coverImageKey);
        } catch (err) {
          if (err instanceof UploadNotFoundError) {
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
