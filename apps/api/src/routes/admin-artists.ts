import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { hash } from "argon2";
import { Prisma, prisma } from "@akosi/database";
import { requireAdminSession } from "../auth/session.js";
import { generateChallengeToken } from "../auth/crypto.js";
import { sendMail } from "../auth/mailer.js";
import {
  promoteRawUploadToMedia,
  keyMatchesPurpose,
  UploadNotFoundError,
  UploadTooLargeError,
  MEDIA_BUCKET,
  createPresignedPlaybackUrl,
} from "../storage.js";
import {
  archiveArtist,
  restoreArtist,
  deleteArtistPermanently,
  artistCascadeCounts,
  NotFoundError,
  NotArchivedError,
} from "../catalog-lifecycle.js";

const Artist = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  bio: Type.Union([Type.String(), Type.Null()]),
  profileImageUrl: Type.Union([Type.String(), Type.Null()]),
  coverImageUrl: Type.Union([Type.String(), Type.Null()]),
  websiteUrl: Type.Union([Type.String(), Type.Null()]),
  instagramUrl: Type.Union([Type.String(), Type.Null()]),
  twitterUrl: Type.Union([Type.String(), Type.Null()]),
  facebookUrl: Type.Union([Type.String(), Type.Null()]),
  spotifyUrl: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  deletedAt: Type.Union([Type.String(), Type.Null()]),
});

const CascadeCounts = Type.Object({ releases: Type.Integer(), tracks: Type.Integer(), cards: Type.Integer() });

const ErrorResponse = Type.Object({ error: Type.String() });

// A-z, 0-9, single hyphens between segments — matches how the slug
// shows up in a URL later (docs/09-data-model.md: Artist.slug unique).
const SLUG_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$";

async function resolveImageUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  return createPresignedPlaybackUrl({ bucket: MEDIA_BUCKET, key });
}

async function serializeArtist(artist: {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  profileImageKey: string | null;
  coverImageKey: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  facebookUrl: string | null;
  spotifyUrl: string | null;
  createdAt: Date;
  deletedAt: Date | null;
}) {
  return {
    id: artist.id,
    name: artist.name,
    slug: artist.slug,
    bio: artist.bio,
    profileImageUrl: await resolveImageUrl(artist.profileImageKey),
    coverImageUrl: await resolveImageUrl(artist.coverImageKey),
    websiteUrl: artist.websiteUrl,
    instagramUrl: artist.instagramUrl,
    twitterUrl: artist.twitterUrl,
    facebookUrl: artist.facebookUrl,
    spotifyUrl: artist.spotifyUrl,
    createdAt: artist.createdAt.toISOString(),
    deletedAt: artist.deletedAt?.toISOString() ?? null,
  };
}

const ArtistWithCounts = Type.Intersect([
  Artist,
  Type.Object({ releaseCount: Type.Integer(), trackCount: Type.Integer() }),
]);

const ArtistTrack = Type.Object({
  id: Type.String(),
  title: Type.String(),
  trackNumber: Type.Union([Type.Integer(), Type.Null()]),
  mediaType: Type.Union([Type.Literal("AUDIO"), Type.Literal("VIDEO")]),
  status: Type.String(),
  playCount: Type.Integer(),
  cardCount: Type.Integer(),
  locked: Type.Boolean(),
  deletedAt: Type.Union([Type.String(), Type.Null()]),
});

const ArtistRelease = Type.Object({
  id: Type.String(),
  title: Type.String(),
  releasedAt: Type.Union([Type.String(), Type.Null()]),
  tracks: Type.Array(ArtistTrack),
  deletedAt: Type.Union([Type.String(), Type.Null()]),
});

const AccountStatus = Type.Union([Type.Literal("NONE"), Type.Literal("PENDING"), Type.Literal("ACTIVE")]);

const ArtistDetail = Type.Intersect([
  Artist,
  Type.Object({
    totalPlays: Type.Integer(),
    releaseCount: Type.Integer(),
    trackCount: Type.Integer(),
    releases: Type.Array(ArtistRelease),
    // Portal-account state: NONE = never invited, PENDING = invited but
    // still on the temp password, ACTIVE = artist has set a real password.
    accountStatus: AccountStatus,
    accountEmail: Type.Union([Type.String(), Type.Null()]),
  }),
]);

// Website/social fields end up as the href of a real link once a
// profile page renders them — format: "uri" alone accepts
// javascript:/data:/vbscript: URIs too (syntactically valid URIs,
// but executable if ever rendered as <a href={value}>), so nothing
// but http(s) is accepted at the point of storage. Relying on every
// future renderer to re-check the scheme would just be waiting for
// one to forget.
const UrlField = Type.String({ pattern: "^https?://", maxLength: 300 });

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
        return serializeArtist(artist);
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
        querystring: Type.Object({ archived: Type.Optional(Type.Boolean()) }),
        response: { 200: Type.Array(ArtistWithCounts) },
      },
    },
    async (request) => {
      const { archived = false } = request.query;
      const artists = await prisma.artist.findMany({
        where: { deletedAt: archived ? { not: null } : null },
        orderBy: { createdAt: "desc" },
        include: { releases: { select: { _count: { select: { tracks: true } } } } },
      });
      return Promise.all(
        artists.map(async (artist) => ({
          ...(await serializeArtist(artist)),
          releaseCount: artist.releases.length,
          trackCount: artist.releases.reduce((sum, r) => sum + r._count.tracks, 0),
        })),
      );
    },
  );

  typedApp.get(
    "/admin/artists/:id",
    {
      preHandler: requireAdminSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 200: ArtistDetail, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const artist = await prisma.artist.findUnique({
        where: { id: request.params.id },
        include: {
          releases: { include: { tracks: true }, orderBy: { createdAt: "desc" } },
          user: true,
        },
      });
      if (!artist) {
        return reply.code(404).send({ error: "Artist not found." });
      }

      const accountStatus: "NONE" | "PENDING" | "ACTIVE" = !artist.user
        ? "NONE"
        : artist.user.passwordSetAt
          ? "ACTIVE"
          : "PENDING";

      const trackIds = artist.releases.flatMap((r) => r.tracks.map((t) => t.id));
      const [playCounts, activeCardCounts, everCardCounts] = await Promise.all([
        prisma.playEvent.groupBy({ by: ["trackId"], where: { trackId: { in: trackIds } }, _count: true }),
        prisma.card.groupBy({
          by: ["trackId"],
          where: { trackId: { in: trackIds }, status: { not: "REVOKED" } },
          _count: true,
        }),
        // "Locked" tracks ever having had a card, not currently having
        // an active one — a track with only revoked cards stays
        // locked (just unredeemable until a new card exists).
        prisma.card.groupBy({ by: ["trackId"], where: { trackId: { in: trackIds } }, _count: true }),
      ]);
      const playCountByTrack = new Map(playCounts.map((p) => [p.trackId, p._count]));
      const cardCountByTrack = new Map(activeCardCounts.map((c) => [c.trackId!, c._count]));
      const everHadCardTrackIds = new Set(everCardCounts.map((c) => c.trackId!));
      const totalPlays = playCounts.reduce((sum, p) => sum + p._count, 0);

      return {
        ...(await serializeArtist(artist)),
        totalPlays,
        releaseCount: artist.releases.length,
        trackCount: trackIds.length,
        accountStatus,
        accountEmail: artist.user?.email ?? null,
        releases: artist.releases.map((release) => ({
          id: release.id,
          title: release.title,
          releasedAt: release.releasedAt?.toISOString() ?? null,
          deletedAt: release.deletedAt?.toISOString() ?? null,
          tracks: release.tracks.map((track) => ({
            id: track.id,
            title: track.title,
            trackNumber: track.trackNumber,
            mediaType: track.mediaType as "AUDIO" | "VIDEO",
            status: track.status,
            playCount: playCountByTrack.get(track.id) ?? 0,
            cardCount: cardCountByTrack.get(track.id) ?? 0,
            locked: everHadCardTrackIds.has(track.id),
            deletedAt: track.deletedAt?.toISOString() ?? null,
          })),
        })),
      };
    },
  );

  typedApp.patch(
    "/admin/artists/:id",
    {
      preHandler: requireAdminSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          bio: Type.Optional(Type.String({ maxLength: 2000 })),
          websiteUrl: Type.Optional(Type.Union([UrlField, Type.Null()])),
          instagramUrl: Type.Optional(Type.Union([UrlField, Type.Null()])),
          twitterUrl: Type.Optional(Type.Union([UrlField, Type.Null()])),
          facebookUrl: Type.Optional(Type.Union([UrlField, Type.Null()])),
          spotifyUrl: Type.Optional(Type.Union([UrlField, Type.Null()])),
          profileImageKey: Type.Optional(Type.String()),
          coverImageKey: Type.Optional(Type.String()),
        }),
        response: { 200: Artist, 400: ErrorResponse, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const existing = await prisma.artist.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.code(404).send({ error: "Artist not found." });
      }

      const { bio, websiteUrl, instagramUrl, twitterUrl, facebookUrl, spotifyUrl, profileImageKey, coverImageKey } =
        request.body;
      const data: Parameters<typeof prisma.artist.update>[0]["data"] = {};

      if (bio !== undefined) data.bio = bio;
      if (websiteUrl !== undefined) data.websiteUrl = websiteUrl;
      if (instagramUrl !== undefined) data.instagramUrl = instagramUrl;
      if (twitterUrl !== undefined) data.twitterUrl = twitterUrl;
      if (facebookUrl !== undefined) data.facebookUrl = facebookUrl;
      if (spotifyUrl !== undefined) data.spotifyUrl = spotifyUrl;

      for (const [key, purpose] of [
        [profileImageKey, "artist-profile"],
        [coverImageKey, "artist-cover"],
      ] as const) {
        if (key === undefined) continue;
        if (!keyMatchesPurpose(key, purpose)) {
          return reply.code(400).send({ error: `This doesn't look like a presigned ${purpose} upload.` });
        }
        try {
          await promoteRawUploadToMedia(key, purpose);
        } catch (err) {
          if (err instanceof UploadNotFoundError || err instanceof UploadTooLargeError) {
            return reply.code(400).send({ error: err.message });
          }
          throw err;
        }
      }
      if (profileImageKey !== undefined) data.profileImageKey = profileImageKey;
      if (coverImageKey !== undefined) data.coverImageKey = coverImageKey;

      const artist = await prisma.artist.update({ where: { id: existing.id }, data });
      return serializeArtist(artist);
    },
  );

  // One action, three meanings depending on current state — the admin UI
  // just shows a differently-labeled button ("Invite" / "Resend invite" /
  // "Reset portal password"), all driven by the same accountStatus this
  // route changes. The generated temp password is never returned here —
  // it's emailed directly to the artist, same as every other code this
  // app ever sends (see auth/challenges.ts).
  typedApp.post(
    "/admin/artists/:id/invite",
    {
      preHandler: requireAdminSession,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({ email: Type.String({ format: "email" }) }),
        response: { 200: Type.Object({ ok: Type.Literal(true) }), 404: ErrorResponse, 409: ErrorResponse },
      },
    },
    async (request, reply) => {
      const artist = await prisma.artist.findUnique({ where: { id: request.params.id } });
      if (!artist) {
        return reply.code(404).send({ error: "Artist not found." });
      }

      const { email } = request.body;
      const tempPassword = generateChallengeToken();
      const passwordHash = await hash(tempPassword);

      try {
        if (!artist.userId) {
          const user = await prisma.user.create({
            data: { email, role: "ARTIST", passwordHash },
          });
          await prisma.artist.update({
            where: { id: artist.id },
            data: { userId: user.id, invitedAt: new Date() },
          });
        } else {
          // Resend (still pending) or reset (already active) — both
          // overwrite the password and re-stamp invitedAt, which is what
          // bounds the temp password's lifetime (see artist-auth.ts).
          // Forcing passwordSetAt back to null either way means an
          // "already active" artist goes through PASSWORD_SETUP again
          // next login, exactly like a fresh invite.
          await prisma.user.update({
            where: { id: artist.userId },
            data: { email, passwordHash, passwordSetAt: null },
          });
          await prisma.artist.update({ where: { id: artist.id }, data: { invitedAt: new Date() } });
        }
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return reply.code(409).send({ error: "That email is already in use by another account." });
        }
        throw err;
      }

      const webOrigin = (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(",")[0].trim();
      await sendMail({
        to: email,
        subject: "You're invited to the akosi.music artist portal",
        text: `You've been invited to manage "${artist.name}" on akosi.music.\n\nSign in at ${webOrigin}/artist/login with:\n\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nYou'll be asked to set a real password on first sign-in. This invite expires in 7 days.`,
      });

      return { ok: true as const };
    },
  );

  typedApp.post(
    "/admin/artists/:id/archive",
    {
      preHandler: requireAdminSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 200: Artist, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      try {
        return await serializeArtist(await archiveArtist(request.params.id));
      } catch (err) {
        if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message });
        throw err;
      }
    },
  );

  typedApp.post(
    "/admin/artists/:id/restore",
    {
      preHandler: requireAdminSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 200: Artist, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      try {
        return await serializeArtist(await restoreArtist(request.params.id));
      } catch (err) {
        if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message });
        throw err;
      }
    },
  );

  typedApp.get(
    "/admin/artists/:id/cascade-counts",
    {
      preHandler: requireAdminSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 200: CascadeCounts },
      },
    },
    async (request) => artistCascadeCounts(request.params.id),
  );

  typedApp.delete(
    "/admin/artists/:id",
    {
      preHandler: requireAdminSession,
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ ok: Type.Literal(true) }), 404: ErrorResponse, 409: ErrorResponse },
      },
    },
    async (request, reply) => {
      try {
        await deleteArtistPermanently(request.params.id);
        return { ok: true as const };
      } catch (err) {
        if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message });
        if (err instanceof NotArchivedError) return reply.code(409).send({ error: err.message });
        throw err;
      }
    },
  );
}
