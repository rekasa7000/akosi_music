import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { prisma } from "@akosi/database";
import { getUnlockCardId, isTrackUnlocked } from "../auth/fan-unlock.js";
import { MEDIA_BUCKET, createPresignedPlaybackUrl } from "../storage.js";

const PlayResponse = Type.Object({
  url: Type.String(),
  mediaType: Type.Union([Type.Literal("AUDIO"), Type.Literal("VIDEO")]),
});

const ErrorResponse = Type.Object({ error: Type.String() });

export async function publicTrackRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  // The one route that actually mints a playback URL — per
  // docs/08-conventions.md, this is the only thing that ever sees a
  // storage link; the player only ever receives this response.
  typedApp.get(
    "/tracks/:id/play",
    {
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 200: PlayResponse, 403: ErrorResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const track = await prisma.track.findUnique({
        where: { id: request.params.id },
        include: { cards: true },
      });
      if (!track || track.status !== "READY" || track.deletedAt) {
        return reply.code(404).send({ error: "Track not found." });
      }

      const activeCardIds = track.cards.filter((c) => c.status !== "REVOKED").map((c) => c.id);
      // Gated by *ever* having had a card, not by currently having an
      // active one — see the matching note in public-releases.ts.
      const gated = track.cards.length > 0;
      if (gated && !isTrackUnlocked(request, track.id, activeCardIds)) {
        return reply.code(403).send({ error: "This track is locked." });
      }

      const key = track.processedStorageKey ?? track.rawStorageKey;
      if (!key) {
        return reply.code(404).send({ error: "Track not found." });
      }

      const url = await createPresignedPlaybackUrl({ bucket: MEDIA_BUCKET, key });
      // Attributes the play to whichever card actually unlocked this
      // track in this request, if any — null for a track with no
      // cards (still public).
      const cardId = getUnlockCardId(request, track.id);
      await prisma.playEvent.create({ data: { trackId: track.id, cardId } });

      return { url, mediaType: track.mediaType as "AUDIO" | "VIDEO" };
    },
  );
}
