import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { prisma } from "@akosi/database";
import { requireArtistSession } from "../auth/artist-session.js";
import { playsByDayWindow } from "./admin-stats.js";

const Stats = Type.Object({
  totalPlays: Type.Integer(),
  playsToday: Type.Integer(),
  playsByDay: Type.Array(Type.Object({ date: Type.String(), plays: Type.Integer() })),
  releaseCount: Type.Integer(),
  trackCount: Type.Integer(),
  cardCount: Type.Integer(),
  cardsByStatus: Type.Object({
    UNCLAIMED: Type.Integer(),
    CLAIMED: Type.Integer(),
    REVOKED: Type.Integer(),
  }),
  ownerCount: Type.Integer(),
});

// The uid is the unlock code, so no part of it may appear here — the
// display serial is derived from the card's internal id instead, which
// identifies the row without leaking secret material.
const ArtistCard = Type.Object({
  id: Type.String(),
  serial: Type.String(),
  status: Type.String(),
  editionLabel: Type.Union([Type.String(), Type.Null()]),
  provisionedAt: Type.String(),
  trackTitle: Type.String(),
  releaseTitle: Type.String(),
  playCount: Type.Integer(),
  claimed: Type.Boolean(),
});

const Fan = Type.Object({
  // Opaque pseudonym ("Collector #N" by first-claim order) — the
  // artist sees their crowd's shape, never fan emails or fragments of
  // them. sinceMonth is month-precision for the same reason: a fan's
  // exact claim timestamp is the fan's data, not the artist's.
  ownerLabel: Type.String(),
  cardsOwned: Type.Integer(),
  totalPlays: Type.Integer(),
  sinceMonth: Type.String(),
});

const ErrorResponse = Type.Object({ error: Type.String() });

// deletedAt filter is defense in depth — requireArtistSession already
// rejects archived artists centrally.
async function requireOwnArtist(artistUserId: string | undefined) {
  if (!artistUserId) return null;
  return prisma.artist.findFirst({ where: { userId: artistUserId, deletedAt: null } });
}

export async function artistInsightRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.get(
    "/artist/stats",
    {
      preHandler: requireArtistSession,
      schema: { response: { 200: Stats, 404: ErrorResponse } },
    },
    async (request, reply) => {
      const artist = await requireOwnArtist(request.artistUserId);
      if (!artist) {
        return reply.code(404).send({ error: "Artist profile not found." });
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const ownTrack = { track: { release: { artistId: artist.id } } };

      const [totalPlays, playsToday, playsByDay, releaseCount, trackCount, cardsByStatus, ownerCount] =
        await Promise.all([
          prisma.playEvent.count({ where: ownTrack }),
          prisma.playEvent.count({ where: { ...ownTrack, playedAt: { gte: todayStart } } }),
          playsByDayWindow({ artistId: artist.id }),
          prisma.release.count({ where: { artistId: artist.id, deletedAt: null } }),
          prisma.track.count({ where: { release: { artistId: artist.id }, deletedAt: null } }),
          prisma.card.groupBy({
            by: ["status"],
            where: { artistId: artist.id, trackId: { not: null } },
            _count: true,
          }),
          prisma.cardOwnership.groupBy({
            by: ["userId"],
            where: { card: { artistId: artist.id } },
          }),
        ]);

      const statusCounts = { UNCLAIMED: 0, CLAIMED: 0, REVOKED: 0 };
      for (const row of cardsByStatus) {
        statusCounts[row.status] = row._count;
      }

      return {
        totalPlays,
        playsToday,
        playsByDay,
        releaseCount,
        trackCount,
        cardCount: statusCounts.UNCLAIMED + statusCounts.CLAIMED + statusCounts.REVOKED,
        cardsByStatus: statusCounts,
        ownerCount: ownerCount.length,
      };
    },
  );

  typedApp.get(
    "/artist/cards",
    {
      preHandler: requireArtistSession,
      schema: { response: { 200: Type.Array(ArtistCard), 404: ErrorResponse } },
    },
    async (request, reply) => {
      const artist = await requireOwnArtist(request.artistUserId);
      if (!artist) {
        return reply.code(404).send({ error: "Artist profile not found." });
      }

      const cards = await prisma.card.findMany({
        where: { artistId: artist.id, trackId: { not: null } },
        orderBy: { provisionedAt: "desc" },
        include: {
          track: { select: { title: true, release: { select: { title: true } } } },
          ownership: { select: { id: true } },
          _count: { select: { playEvents: true } },
        },
      });

      return cards.map((card) => ({
        id: card.id,
        serial: card.id.slice(-4).toUpperCase(),
        status: card.status,
        editionLabel: card.editionLabel,
        provisionedAt: card.provisionedAt.toISOString(),
        trackTitle: card.track?.title ?? "—",
        releaseTitle: card.track?.release?.title ?? "—",
        playCount: card._count.playEvents,
        claimed: card.ownership !== null,
      }));
    },
  );

  typedApp.get(
    "/artist/fans",
    {
      preHandler: requireArtistSession,
      schema: { response: { 200: Type.Array(Fan), 404: ErrorResponse } },
    },
    async (request, reply) => {
      const artist = await requireOwnArtist(request.artistUserId);
      if (!artist) {
        return reply.code(404).send({ error: "Artist profile not found." });
      }

      const ownerships = await prisma.cardOwnership.findMany({
        where: { card: { artistId: artist.id } },
        include: {
          card: { select: { _count: { select: { playEvents: true } } } },
        },
        orderBy: { claimedAt: "asc" },
      });

      const byUser = new Map<
        string,
        { ownerLabel: string; cardsOwned: number; totalPlays: number; firstClaimedAt: Date }
      >();
      for (const ownership of ownerships) {
        const existing = byUser.get(ownership.userId);
        const plays = ownership.card._count.playEvents;
        if (existing) {
          existing.cardsOwned += 1;
          existing.totalPlays += plays;
        } else {
          byUser.set(ownership.userId, {
            // Numbered in first-claim order — stable as long as earlier
            // claims aren't deleted, and carries zero fan identity.
            ownerLabel: `Collector #${byUser.size + 1}`,
            cardsOwned: 1,
            totalPlays: plays,
            firstClaimedAt: ownership.claimedAt,
          });
        }
      }

      return [...byUser.values()]
        .sort((a, b) => b.totalPlays - a.totalPlays || b.cardsOwned - a.cardsOwned)
        .map(({ firstClaimedAt, ...fan }) => ({
          ...fan,
          sinceMonth: firstClaimedAt.toISOString().slice(0, 7),
        }));
    },
  );
}
