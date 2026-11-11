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
  playsToday: Type.Integer(),
  playsByDay: Type.Array(Type.Object({ date: Type.String(), plays: Type.Integer() })),
  cardCount: Type.Integer(),
  cardsByStatus: Type.Object({
    UNCLAIMED: Type.Integer(),
    CLAIMED: Type.Integer(),
    REVOKED: Type.Integer(),
  }),
});

const TREND_DAYS = 14;

// Local calendar date, not toISOString() — the window starts at local
// midnight, so UTC-keyed buckets would shift "today" into yesterday
// on any timezone east of UTC.
function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Zero-filled day buckets so the dashboard chart always has a full
// 14-day axis, even on days with no plays at all.
export async function playsByDayWindow(where?: { artistId: string }) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (TREND_DAYS - 1));

  const events = await prisma.playEvent.findMany({
    where: {
      playedAt: { gte: since },
      ...(where ? { track: { release: { artistId: where.artistId } } } : {}),
    },
    select: { playedAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < TREND_DAYS; i++) {
    const day = new Date(since);
    day.setDate(since.getDate() + i);
    buckets.set(localDateKey(day), 0);
  }
  for (const event of events) {
    const key = localDateKey(event.playedAt);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, plays]) => ({ date, plays }));
}

export async function adminStatsRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.get(
    "/admin/stats",
    {
      preHandler: requireAdminSession,
      schema: { response: { 200: Stats } },
    },
    async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [artistCount, releaseCount, trackCount, totalPlays, playsToday, playsByDay, cardsByStatus] =
        await Promise.all([
          prisma.artist.count({ where: { deletedAt: null } }),
          prisma.release.count({ where: { deletedAt: null } }),
          prisma.track.count({ where: { deletedAt: null } }),
          prisma.playEvent.count(),
          prisma.playEvent.count({ where: { playedAt: { gte: todayStart } } }),
          playsByDayWindow(),
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
        playsToday,
        playsByDay,
        cardCount: statusCounts.UNCLAIMED + statusCounts.CLAIMED + statusCounts.REVOKED,
        cardsByStatus: statusCounts,
      };
    },
  );
}
