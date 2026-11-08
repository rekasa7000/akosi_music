import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { prisma } from "@akosi/database";
import { requireAdminSession } from "../auth/session.js";

const Stats = Type.Object({
  artistCount: Type.Integer(),
  releaseCount: Type.Integer(),
  trackCount: Type.Integer(),
  totalPlays: Type.Integer(),
  cardCount: Type.Integer(),
  cardsByStatus: Type.Object({
    UNCLAIMED: Type.Integer(),
    CLAIMED: Type.Integer(),
    REVOKED: Type.Integer(),
  }),
});

export async function adminStatsRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.get(
    "/admin/stats",
    {
      preHandler: requireAdminSession,
      schema: { response: { 200: Stats } },
    },
    async () => {
      const [artistCount, releaseCount, trackCount, totalPlays, cardsByStatus] = await Promise.all([
        prisma.artist.count({ where: { deletedAt: null } }),
        prisma.release.count({ where: { deletedAt: null } }),
        prisma.track.count({ where: { deletedAt: null } }),
        prisma.playEvent.count(),
        prisma.card.groupBy({ by: ["status"], where: { trackId: { not: null } }, _count: true }),
      ]);

      const statusCounts = { UNCLAIMED: 0, CLAIMED: 0, REVOKED: 0 };
      for (const row of cardsByStatus) {
        statusCounts[row.status] = row._count;
      }

      return {
        artistCount,
        releaseCount,
        trackCount,
        totalPlays,
        cardCount: statusCounts.UNCLAIMED + statusCounts.CLAIMED + statusCounts.REVOKED,
        cardsByStatus: statusCounts,
      };
    },
  );
}
