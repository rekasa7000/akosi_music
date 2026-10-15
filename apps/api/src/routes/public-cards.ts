import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { prisma } from "@akosi/database";
import { grantTrackUnlock } from "../auth/fan-unlock.js";
import { MEDIA_BUCKET, createPresignedPlaybackUrl } from "../storage.js";

const RedeemedTrack = Type.Object({
  id: Type.String(),
  title: Type.String(),
  trackNumber: Type.Union([Type.Integer(), Type.Null()]),
  durationSec: Type.Union([Type.Integer(), Type.Null()]),
  mediaType: Type.Union([Type.Literal("AUDIO"), Type.Literal("VIDEO")]),
  lyrics: Type.Union([Type.String(), Type.Null()]),
  coverUrl: Type.Union([Type.String(), Type.Null()]),
  releaseId: Type.String(),
  releaseTitle: Type.String(),
  artistName: Type.String(),
});

const ErrorResponse = Type.Object({ error: Type.String() });

async function resolveCoverUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  return createPresignedPlaybackUrl({ bucket: MEDIA_BUCKET, key });
}

export async function publicCardRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  // Redeeming a card is the whole point of tapping one — whether the
  // tap URL carries the code automatically or a fan types it in by
  // hand after finding the track locked, this is the one route that
  // turns "I have this card" into playback access.
  typedApp.post(
    "/cards/redeem",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        body: Type.Object({ uid: Type.String({ minLength: 1 }) }),
        response: { 200: RedeemedTrack, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const card = await prisma.card.findUnique({
        where: { uid: request.body.uid },
        include: { track: { include: { release: { include: { artist: true } } } } },
      });
      if (!card || !card.track || card.status === "REVOKED") {
        return reply.code(404).send({ error: "Invalid or revoked card." });
      }

      await grantTrackUnlock(app, request, reply, card.track.id, card.id);

      const track = card.track;
      return {
        id: track.id,
        title: track.title,
        trackNumber: track.trackNumber,
        durationSec: track.durationSec,
        mediaType: track.mediaType as "AUDIO" | "VIDEO",
        lyrics: track.lyrics,
        coverUrl: await resolveCoverUrl(track.coverImageKey ?? track.release.coverImageKey),
        releaseId: track.release.id,
        releaseTitle: track.release.title,
        artistName: track.release.artist.name,
      };
    },
  );
}
