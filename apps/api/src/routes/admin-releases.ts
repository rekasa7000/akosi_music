import { hash } from "argon2";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { prisma } from "@akosi/database";
import { requireAdminSession } from "../auth/session.js";
import { promoteRawUploadToMedia, keyMatchesPurpose, UploadNotFoundError } from "../storage.js";

const Visibility = Type.Union([Type.Literal("PUBLIC"), Type.Literal("PRIVATE")]);

const Track = Type.Object({
  id: Type.String(),
  title: Type.String(),
  trackNumber: Type.Union([Type.Integer(), Type.Null()]),
  mediaType: Type.String(),
  status: Type.String(),
  coverImageKey: Type.Union([Type.String(), Type.Null()]),
});

const Release = Type.Object({
  id: Type.String(),
  artistId: Type.String(),
  title: Type.String(),
  releasedAt: Type.Union([Type.String(), Type.Null()]),
  visibility: Visibility,
  coverImageKey: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

const ReleaseWithTracks = Type.Intersect([Release, Type.Object({ tracks: Type.Array(Track) })]);

const ErrorResponse = Type.Object({ error: Type.String() });

function serializeRelease(release: {
  id: string;
  artistId: string;
  title: string;
  releasedAt: Date | null;
  visibility: string;
  coverImageKey: string | null;
  createdAt: Date;
}) {
  return {
    id: release.id,
    artistId: release.artistId,
    title: release.title,
    releasedAt: release.releasedAt?.toISOString() ?? null,
    visibility: release.visibility as "PUBLIC" | "PRIVATE",
    coverImageKey: release.coverImageKey,
    createdAt: release.createdAt.toISOString(),
  };
}

export async function adminReleaseRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.post(
    "/admin/releases",
    {
      preHandler: requireAdminSession,
      schema: {
        body: Type.Object({
          artistId: Type.String(),
          title: Type.String({ minLength: 1, maxLength: 200 }),
          releasedAt: Type.Optional(Type.String({ format: "date-time" })),
        }),
        response: { 200: Release, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const { artistId, title, releasedAt } = request.body;
      const artist = await prisma.artist.findUnique({ where: { id: artistId } });
      if (!artist) {
        return reply.code(404).send({ error: "Artist not found." });
      }
      const release = await prisma.release.create({
        data: { artistId, title, releasedAt: releasedAt ? new Date(releasedAt) : undefined },
      });
      return serializeRelease(release);
    },
  );

  typedApp.get(
    "/admin/releases",
    {
      preHandler: requireAdminSession,
      schema: { response: { 200: Type.Array(Release) } },
    },
    async () => {
      const releases = await prisma.release.findMany({ orderBy: { createdAt: "desc" } });
      return releases.map(serializeRelease);
    },
  );

  typedApp.get(
    "/admin/releases/:id",
    {
      preHandler: requireAdminSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 200: ReleaseWithTracks, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const release = await prisma.release.findUnique({
        where: { id: request.params.id },
        include: { tracks: { orderBy: { trackNumber: "asc" } } },
      });
      if (!release) {
        return reply.code(404).send({ error: "Release not found." });
      }
      return {
        ...serializeRelease(release),
        tracks: release.tracks.map((track) => ({
          id: track.id,
          title: track.title,
          trackNumber: track.trackNumber,
          mediaType: track.mediaType,
          status: track.status,
          coverImageKey: track.coverImageKey,
        })),
      };
    },
  );

  typedApp.patch(
    "/admin/releases/:id",
    {
      preHandler: requireAdminSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          title: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
          releasedAt: Type.Optional(Type.String({ format: "date-time" })),
          visibility: Type.Optional(Visibility),
          password: Type.Optional(Type.String({ minLength: 6, maxLength: 200 })),
          coverImageKey: Type.Optional(Type.String()),
        }),
        response: { 200: Release, 400: ErrorResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const existing = await prisma.release.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.code(404).send({ error: "Release not found." });
      }

      const { title, releasedAt, visibility, password, coverImageKey } = request.body;
      const data: Parameters<typeof prisma.release.update>[0]["data"] = {};

      if (title !== undefined) data.title = title;
      if (releasedAt !== undefined) data.releasedAt = new Date(releasedAt);

      const visibilityResult = resolveVisibility({
        requestedVisibility: visibility,
        password,
        alreadyHasPassword: existing.passwordHash != null,
      });
      if (!visibilityResult.ok) {
        return reply.code(400).send({ error: visibilityResult.error });
      }
      Object.assign(data, visibilityResult.data);
      if (password) {
        data.passwordHash = await hash(password);
      }

      if (coverImageKey !== undefined) {
        if (!keyMatchesPurpose(coverImageKey, "release-cover")) {
          return reply.code(400).send({ error: "coverImageKey doesn't look like a presigned release-cover upload." });
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

      const release = await prisma.release.update({ where: { id: existing.id }, data });
      return serializeRelease(release);
    },
  );
}

type VisibilityResolution =
  | { ok: true; data: { visibility?: "PUBLIC" | "PRIVATE"; passwordHash?: null } }
  | { ok: false; error: string };

// A password implies PRIVATE regardless of what visibility says, and
// PUBLIC always clears any stored password — the two fields shouldn't
// be able to drift out of sync with each other.
function resolveVisibility(params: {
  requestedVisibility?: "PUBLIC" | "PRIVATE";
  password?: string;
  alreadyHasPassword: boolean;
}): VisibilityResolution {
  if (params.password) {
    return { ok: true, data: { visibility: "PRIVATE" } };
  }
  if (params.requestedVisibility === "PUBLIC") {
    return { ok: true, data: { visibility: "PUBLIC", passwordHash: null } };
  }
  if (params.requestedVisibility === "PRIVATE") {
    if (!params.alreadyHasPassword) {
      return { ok: false, error: "A private release needs a password." };
    }
    return { ok: true, data: { visibility: "PRIVATE" } };
  }
  return { ok: true, data: {} };
}
