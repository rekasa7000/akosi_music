import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Prisma, prisma } from "@akosi/database";
import { requireAdminSession } from "../auth/session.js";

const Artist = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  bio: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

const ErrorResponse = Type.Object({ error: Type.String() });

// A-z, 0-9, single hyphens between segments — matches how the slug
// shows up in a URL later (docs/09-data-model.md: Artist.slug unique).
const SLUG_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$";

export async function adminArtistRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.post(
    "/admin/artists",
    {
      preHandler: requireAdminSession,
      schema: {
        body: Type.Object({
          name: Type.String({ minLength: 1, maxLength: 200 }),
          slug: Type.String({ pattern: SLUG_PATTERN, maxLength: 100 }),
          bio: Type.Optional(Type.String({ maxLength: 2000 })),
        }),
        response: { 200: Artist, 409: ErrorResponse },
      },
    },
    async (request, reply) => {
      const { name, slug, bio } = request.body;
      try {
        const artist = await prisma.artist.create({ data: { name, slug, bio } });
        return { ...artist, createdAt: artist.createdAt.toISOString() };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return reply.code(409).send({ error: "An artist with that slug already exists." });
        }
        throw err;
      }
    },
  );

  typedApp.get(
    "/admin/artists",
    {
      preHandler: requireAdminSession,
      schema: {
        response: { 200: Type.Array(Artist) },
      },
    },
    async () => {
      const artists = await prisma.artist.findMany({ orderBy: { createdAt: "desc" } });
      return artists.map((artist) => ({ ...artist, createdAt: artist.createdAt.toISOString() }));
    },
  );
}
