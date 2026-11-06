import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { requireArtistSession } from "../auth/artist-session.js";
import { RAW_BUCKET, createPresignedUploadUrl, generateUploadKey } from "../storage.js";
import type { MediaUploadPurpose } from "../storage.js";

// Narrower than admin's purpose union — no "artist-profile"/"artist-cover"
// here, since own-profile editing is out of v1 scope (see plan).
const Purpose = Type.Union([
  Type.Literal("release-cover"),
  Type.Literal("track-cover"),
  Type.Literal("track-audio"),
  Type.Literal("track-video"),
]);

const RASTER_IMAGE_PATTERN = "^image/(jpeg|png|webp|gif)$";

const CONTENT_TYPE_PATTERN: Record<"release-cover" | "track-cover" | "track-audio" | "track-video", string> = {
  "release-cover": RASTER_IMAGE_PATTERN,
  "track-cover": RASTER_IMAGE_PATTERN,
  "track-audio": "^audio/[a-zA-Z0-9][a-zA-Z0-9.+-]*$",
  "track-video": "^video/[a-zA-Z0-9][a-zA-Z0-9.+-]*$",
};

export async function artistMediaRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  // No ownership check here — nothing is persisted at presign time, same
  // as admin-media.ts. Ownership is enforced at the confirm step
  // (artist-tracks.ts / artist-releases.ts), where the key actually gets
  // attached to a row.
  typedApp.post(
    "/artist/media/presign",
    {
      preHandler: requireArtistSession,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        body: Type.Object({
          purpose: Purpose,
          contentType: Type.String({ minLength: 1 }),
        }),
        response: {
          200: Type.Object({ key: Type.String(), uploadUrl: Type.String() }),
          400: Type.Object({ error: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const { purpose, contentType } = request.body;
      const pattern = new RegExp(CONTENT_TYPE_PATTERN[purpose]);
      if (!pattern.test(contentType)) {
        const expected =
          purpose === "track-audio"
            ? "audio/*"
            : purpose === "track-video"
              ? "video/*"
              : "image/jpeg, image/png, image/webp, or image/gif";
        return reply.code(400).send({ error: `contentType must be ${expected} for purpose "${purpose}".` });
      }

      const key = generateUploadKey(purpose as MediaUploadPurpose);
      const uploadUrl = await createPresignedUploadUrl({ bucket: RAW_BUCKET, key, contentType });
      return { key, uploadUrl };
    },
  );
}
