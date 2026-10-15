import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Prisma, prisma } from "@akosi/database";
import { requireAdminSession } from "../auth/session.js";

// Phase 0.5: cards are manufactured manually (docs/11-mvp-phase0.md).
// An admin provisions one by typing in its printed code (Card.uid)
// and assigning it to a track — the code is the password until real
// NFC auth exists. These routes are the only place a Card row gets
// created or revoked.

const CardStatus = Type.Union([
  Type.Literal("UNCLAIMED"),
  Type.Literal("CLAIMED"),
  Type.Literal("REVOKED"),
]);

const Card = Type.Object({
  id: Type.String(),
  uid: Type.String(),
  status: CardStatus,
  editionLabel: Type.Union([Type.String(), Type.Null()]),
  provisionedAt: Type.String(),
  trackId: Type.String(),
  trackTitle: Type.String(),
  releaseId: Type.String(),
  releaseTitle: Type.String(),
  artistId: Type.String(),
  artistName: Type.String(),
  playCount: Type.Integer(),
});

const ErrorResponse = Type.Object({ error: Type.String() });

// A-Z, 0-9, hyphens — printable on a physical card and typeable by a
// fan without ambiguous characters tripping them up.
const CODE_PATTERN = "^[A-Za-z0-9-]+$";

async function serializeCards(
  cards: Prisma.CardGetPayload<{ include: { track: { include: { release: { include: { artist: true } } } } } }>[],
) {
  const playCounts = await prisma.playEvent.groupBy({
    by: ["cardId"],
    where: { cardId: { in: cards.map((c) => c.id) } },
    _count: true,
  });
  const countByCard = new Map(playCounts.map((p) => [p.cardId, p._count]));

  return cards
    .filter((c) => c.track != null)
    .map((c) => {
      const track = c.track!;
      return {
        id: c.id,
        uid: c.uid,
        status: c.status,
        editionLabel: c.editionLabel,
        provisionedAt: c.provisionedAt.toISOString(),
        trackId: track.id,
        trackTitle: track.title,
        releaseId: track.release.id,
        releaseTitle: track.release.title,
        artistId: track.release.artist.id,
        artistName: track.release.artist.name,
        playCount: countByCard.get(c.id) ?? 0,
      };
    });
}

export async function adminCardRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.post(
    "/admin/cards",
    {
      preHandler: requireAdminSession,
      schema: {
        body: Type.Object({
          uid: Type.String({ pattern: CODE_PATTERN, minLength: 4, maxLength: 64 }),
          trackId: Type.String(),
          editionLabel: Type.Optional(Type.String({ maxLength: 100 })),
        }),
        response: { 200: Card, 404: ErrorResponse, 409: ErrorResponse },
      },
    },
    async (request, reply) => {
      const { uid, trackId, editionLabel } = request.body;
      const track = await prisma.track.findUnique({
        where: { id: trackId },
        include: { release: { include: { artist: true } } },
      });
      // The admin UI's picker only ever lists READY tracks, but this
      // route doesn't have to trust that — a card provisioned against
      // a still-PROCESSING or FAILED track would be redeemable (and
      // would leak that track's metadata) before it's meant to exist
      // publicly at all. The track picker's own filter is why this
      // never happens through normal use, not why it's safe to skip
      // here.
      if (!track || track.status !== "READY") {
        return reply.code(404).send({ error: "Track not found." });
      }

      try {
        const card = await prisma.card.create({
          data: {
            uid,
            trackId,
            artistId: track.release.artist.id,
            editionLabel,
          },
          include: { track: { include: { release: { include: { artist: true } } } } },
        });
        return (await serializeCards([card]))[0];
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return reply.code(409).send({ error: "A card with that code already exists." });
        }
        throw err;
      }
    },
  );

  typedApp.get(
    "/admin/cards",
    {
      preHandler: requireAdminSession,
      schema: { response: { 200: Type.Array(Card) } },
    },
    async () => {
      const cards = await prisma.card.findMany({
        where: { trackId: { not: null } },
        include: { track: { include: { release: { include: { artist: true } } } } },
        orderBy: { createdAt: "desc" },
      });
      return serializeCards(cards);
    },
  );

  typedApp.patch(
    "/admin/cards/:id",
    {
      preHandler: requireAdminSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          status: Type.Optional(Type.Union([Type.Literal("UNCLAIMED"), Type.Literal("REVOKED")])),
          editionLabel: Type.Optional(Type.String({ maxLength: 100 })),
        }),
        response: { 200: Card, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const existing = await prisma.card.findUnique({ where: { id: request.params.id } });
      if (!existing || !existing.trackId) {
        return reply.code(404).send({ error: "Card not found." });
      }

      const { status, editionLabel } = request.body;
      const card = await prisma.card.update({
        where: { id: existing.id },
        data: {
          ...(status !== undefined && { status }),
          ...(editionLabel !== undefined && { editionLabel }),
        },
        include: { track: { include: { release: { include: { artist: true } } } } },
      });
      return (await serializeCards([card]))[0];
    },
  );
}
