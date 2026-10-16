import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { requireAdminSession } from "../auth/session.js";
import { RAW_BUCKET, createPresignedUploadUrl, generateUploadKey } from "../storage.js";
import type { MediaUploadPurpose } from "../storage.js";

const Purpose = Type.Union([
  Type.Literal("release-cover"),
  Type.Literal("track-cover"),
  Type.Literal("track-audio"),
  Type.Literal("track-video"),
  Type.Literal("artist-profile"),
  Type.Literal("artist-cover"),
]);

// Raster formats only, enumerated explicitly — the previous
// "^image/[a-zA-Z0-9]..." pattern also matched image/svg+xml, and an
// SVG can embed <script>/event-handler content that executes if the
// uploaded file is ever opened directly (new tab, direct bucket URL)
// instead of rendered inside an <img>. Cover art has no legitimate
// reason to be a vector format here, so it's excluded entirely rather
// than sanitized.
const RASTER_IMAGE_PATTERN = "^image/(jpeg|png|webp|gif)$";

const CONTENT_TYPE_PATTERN: Record<MediaUploadPurpose, string> = {
  "release-cover": RASTER_IMAGE_PATTERN,
  "track-cover": RASTER_IMAGE_PATTERN,
  "track-audio": "^audio/[a-zA-Z0-9][a-zA-Z0-9.+-]*$",
  "track-video": "^video/[a-zA-Z0-9][a-zA-Z0-9.+-]*$",
  "artist-profile": RASTER_IMAGE_PATTERN,
  "artist-cover": RASTER_IMAGE_PATTERN,
};

export async function adminMediaRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  // Single presign endpoint for every admin upload (release covers,
  // track covers, audio, video) rather than one per kind — they're
  // structurally identical (generate a key scoped to the purpose,
  // return a presigned PUT) and TypeBox already enforces the
  // content-type/purpose pairing, so a client can't request a
  // "track-audio" key and upload a video to it undetected later
  // (confirmation re-checks the key's purpose prefix too — see
  // admin-tracks.ts / admin-releases.ts).
  typedApp.post(
    "/admin/media/presign",
    {
      preHandler: requireAdminSession,
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

      const key = generateUploadKey(purpose);
      const uploadUrl = await createPresignedUploadUrl({ bucket: RAW_BUCKET, key, contentType });
      return { key, uploadUrl };
    },
  );
}
