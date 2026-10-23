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
//
// A catalog on the order of hundreds to low thousands of cards makes
// "fetch every card, group client-side" the wrong shape — the browser
// pays for every row on every page load even when nearly all of them
// stay collapsed. Instead: a cheap GROUP BY-style summary (counts
// only, one query regardless of total rows) drives the group headers,
// and actual card rows for a group are only fetched, cursor-paginated,
// once the admin expands it.

const CardStatus = Type.Union([
  Type.Literal("UNCLAIMED"),
  Type.Literal("CLAIMED"),
  Type.Literal("REVOKED"),
]);

const GroupBy = Type.Union([
  Type.Literal("artist"),
  Type.Literal("release"),
  Type.Literal("track"),
  Type.Literal("status"),
  Type.Literal("edition"),
]);
type GroupByValue = "artist" | "release" | "track" | "status" | "edition";

// Sentinel for "no edition label" as a group key — never collides with
// a real id/status/label string.
const NO_EDITION_KEY = "\0none";

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

const CardsPage = Type.Object({
  cards: Type.Array(Card),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
});

const GroupSummary = Type.Object({
  key: Type.String(),
  label: Type.String(),
  count: Type.Integer(),
  activeCount: Type.Integer(),
});

const Stats = Type.Object({
  total: Type.Integer(),
  active: Type.Integer(),
  revoked: Type.Integer(),
});

const ErrorResponse = Type.Object({ error: Type.String() });

// A-Z, 0-9, hyphens — printable on a physical card and typeable by a
// fan without ambiguous characters tripping them up.
const CODE_PATTERN = "^[A-Za-z0-9-]+$";

const BulkCreateResponse = Type.Object({
  created: Type.Array(Card),
  skipped: Type.Array(Type.Object({ uid: Type.String(), reason: Type.String() })),
});

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

function buildSearchWhere(search: string | undefined): Prisma.CardWhereInput {
  if (!search) return {};
  const q = search.trim();
  if (!q) return {};

  const where: Prisma.CardWhereInput = {
    OR: [
      { uid: { contains: q, mode: "insensitive" } },
      { editionLabel: { contains: q, mode: "insensitive" } },
      { track: { title: { contains: q, mode: "insensitive" } } },
      { track: { release: { title: { contains: q, mode: "insensitive" } } } },
      { track: { release: { artist: { name: { contains: q, mode: "insensitive" } } } } },
    ],
  };

  // Lets "revoked" / "unclaimed" / "claimed" in the search box work as
  // a quick status filter alongside the text match, without a
  // separate control.
  const statusMatch = (["UNCLAIMED", "CLAIMED", "REVOKED"] as const).find((s) =>
    s.toLowerCase().startsWith(q.toLowerCase()),
  );
  if (statusMatch) where.OR!.push({ status: statusMatch });

  return where;
}

function buildGroupWhere(groupBy: GroupByValue, groupKey: string): Prisma.CardWhereInput {
  switch (groupBy) {
    case "artist":
      return { artistId: groupKey };
    case "release":
      return { releaseId: groupKey };
    case "track":
      return { trackId: groupKey };
    case "status":
      return { status: groupKey as "UNCLAIMED" | "CLAIMED" | "REVOKED" };
    case "edition":
      return { editionLabel: groupKey === NO_EDITION_KEY ? null : groupKey };
  }
}

type GroupableCard = {
  status: "UNCLAIMED" | "CLAIMED" | "REVOKED";
  editionLabel: string | null;
  artistId: string;
  releaseId: string | null;
  trackId: string | null;
  track: { title: string; release: { title: string; artist: { name: string } } } | null;
};

function groupKeyFor(card: GroupableCard, groupBy: GroupByValue): string | null {
  switch (groupBy) {
    case "artist":
      return card.artistId;
    case "release":
      return card.releaseId;
    case "track":
      return card.trackId;
    case "status":
      return card.status;
    case "edition":
      return card.editionLabel ?? NO_EDITION_KEY;
  }
}

function groupLabelFor(card: GroupableCard, groupBy: GroupByValue): string {
  const track = card.track!;
  switch (groupBy) {
    case "artist":
      return track.release.artist.name;
    case "release":
      return `${track.release.title} — ${track.release.artist.name}`;
    case "track":
      return `${track.title} — ${track.release.title}`;
    case "status":
      return card.status[0] + card.status.slice(1).toLowerCase();
    case "edition":
      return card.editionLabel ?? "No edition";
  }
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

  // Bulk provisioning — the single-card route works fine for one-off
  // additions, but a real print run (hundreds of pre-printed codes for
  // one track) makes typing them in one at a time impractical. Codes
  // are created sequentially rather than in one query so a handful of
  // accidental duplicates don't fail the whole batch — everything else
  // still gets created, and the duplicates come back in `skipped` so
  // the admin can see exactly which physical cards to check.
  typedApp.post(
    "/admin/cards/bulk",
    {
      preHandler: requireAdminSession,
      schema: {
        body: Type.Object({
          trackId: Type.String(),
          uids: Type.Array(Type.String({ pattern: CODE_PATTERN, minLength: 4, maxLength: 64 }), {
            minItems: 1,
            maxItems: 500,
          }),
          editionLabel: Type.Optional(Type.String({ maxLength: 100 })),
        }),
        response: { 200: BulkCreateResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const { trackId, uids, editionLabel } = request.body;
      const track = await prisma.track.findUnique({
        where: { id: trackId },
        include: { release: { include: { artist: true } } },
      });
      if (!track || track.status !== "READY") {
        return reply.code(404).send({ error: "Track not found." });
      }

      const created: Prisma.CardGetPayload<{
        include: { track: { include: { release: { include: { artist: true } } } } };
      }>[] = [];
      const skipped: { uid: string; reason: string }[] = [];
      // Duplicates within the pasted batch itself — caught here instead
      // of relying on the DB round-trip for a cheap, obvious case.
      const seen = new Set<string>();

      for (const uid of uids) {
        if (seen.has(uid)) {
          skipped.push({ uid, reason: "Duplicate in this batch." });
          continue;
        }
        seen.add(uid);

        try {
          const card = await prisma.card.create({
            data: { uid, trackId, artistId: track.release.artist.id, editionLabel },
            include: { track: { include: { release: { include: { artist: true } } } } },
          });
          created.push(card);
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            skipped.push({ uid, reason: "A card with that code already exists." });
          } else {
            throw err;
          }
        }
      }

      return { created: await serializeCards(created), skipped };
    },
  );

  // Cheap aggregate — total/active/revoked across the whole catalog
  // regardless of how many cards exist, independent of search/grouping.
  typedApp.get(
    "/admin/cards/stats",
    {
      preHandler: requireAdminSession,
      schema: { response: { 200: Stats } },
    },
    async () => {
      const [total, revoked] = await Promise.all([
        prisma.card.count({ where: { trackId: { not: null } } }),
        prisma.card.count({ where: { trackId: { not: null }, status: "REVOKED" } }),
      ]);
      return { total, active: total - revoked, revoked };
    },
  );

  // Group headers + counts for whichever dimension the admin picked —
  // a single query over lean fields (no track-cover/ownership/play
  // data), so this stays fast however large the catalog gets. The
  // cards themselves are fetched separately, per group, only once
  // expanded (see GET /admin/cards below).
  typedApp.get(
    "/admin/cards/groups",
    {
      preHandler: requireAdminSession,
      schema: {
        querystring: Type.Object({
          groupBy: GroupBy,
          search: Type.Optional(Type.String()),
        }),
        response: { 200: Type.Array(GroupSummary) },
      },
    },
    async (request) => {
      const { groupBy, search } = request.query;
      const cards = await prisma.card.findMany({
        where: { trackId: { not: null }, ...buildSearchWhere(search) },
        select: {
          status: true,
          editionLabel: true,
          artistId: true,
          releaseId: true,
          trackId: true,
          track: { select: { title: true, release: { select: { title: true, artist: { select: { name: true } } } } } },
        },
      });

      const groups = new Map<string, { label: string; count: number; activeCount: number }>();
      for (const card of cards) {
        if (!card.track) continue;
        const key = groupKeyFor(card, groupBy);
        if (key == null) continue;
        const existing = groups.get(key);
        if (existing) {
          existing.count += 1;
          if (card.status !== "REVOKED") existing.activeCount += 1;
        } else {
          groups.set(key, {
            label: groupLabelFor(card, groupBy),
            count: 1,
            activeCount: card.status === "REVOKED" ? 0 : 1,
          });
        }
      }

      return [...groups.entries()]
        .map(([key, g]) => ({ key, ...g }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
  );

  // Cursor-paginated — drives both "load this group's cards on
  // expand" (groupBy + groupKey set) and flat search results (neither
  // set). `limit` is capped well under anything that would make a
  // single response slow to transfer or render.
  typedApp.get(
    "/admin/cards",
    {
      preHandler: requireAdminSession,
      schema: {
        querystring: Type.Object({
          search: Type.Optional(Type.String()),
          groupBy: Type.Optional(GroupBy),
          groupKey: Type.Optional(Type.String()),
          cursor: Type.Optional(Type.String()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
        }),
        response: { 200: CardsPage },
      },
    },
    async (request) => {
      const { search, groupBy, groupKey, cursor, limit = 100 } = request.query;
      const where: Prisma.CardWhereInput = {
        trackId: { not: null },
        ...buildSearchWhere(search),
        ...(groupBy && groupKey !== undefined ? buildGroupWhere(groupBy, groupKey) : {}),
      };

      const rows = await prisma.card.findMany({
        where,
        include: { track: { include: { release: { include: { artist: true } } } } },
        orderBy: { id: "desc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? page[page.length - 1].id : null;

      return { cards: await serializeCards(page), nextCursor };
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
