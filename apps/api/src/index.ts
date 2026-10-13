import "./env.js";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import fastifyRateLimit from "@fastify/rate-limit";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import {
  RAW_BUCKET,
  MEDIA_BUCKET,
  createPresignedUploadUrl,
  createPresignedPlaybackUrl,
} from "./storage.js";
import { adminAuthRoutes } from "./routes/admin-auth.js";
import { requireAdminSession } from "./auth/session.js";

const app = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();

// apps/web talks to this API cross-origin (different port in dev, a
// different subdomain in prod) and needs the session cookie to come
// along — credentials: true plus an explicit origin allowlist (never
// "*", which the browser rejects alongside credentials anyway).
// WEB_ORIGIN is comma-separated since Next's dev server falls back to
// 3001 when 3000 is already taken by something else.
const webOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((origin) => origin.trim());
await app.register(fastifyCors, {
  origin: webOrigins,
  credentials: true,
});

await app.register(fastifyCookie);
await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me",
});
await app.register(fastifyRateLimit, { global: false });

app.get(
  "/health",
  {
    schema: {
      response: {
        200: Type.Object({
          status: Type.Literal("ok"),
        }),
      },
    },
  },
  async () => ({ status: "ok" as const }),
);

await app.register(adminAuthRoutes);

// Scaffolding only — proves the storage adapter is wired correctly.
// Now gated by requireAdminSession (admin auth exists as of
// docs/12-admin-authentication.md), which closes the "unauthenticated
// credential minting" part of the original security finding. Still
// not the real fix: the client still names an arbitrary bucket/key
// instead of the server generating the key and resolving playback
// through a trackId + release-visibility/ownership check. Don't build
// on top of these routes until that's done.
//
// The explicit opt-in (defaults disabled, fail-closed) stays as a
// second layer regardless — defense in depth, not a substitute for
// the auth check.
const BucketAlias = Type.Union([Type.Literal("raw"), Type.Literal("media")]);
// Restricts uploads to audio/video/image MIME types. Without this, a
// client could set contentType to e.g. "text/html" and have it stick
// as the object's Content-Type — serving attacker-controlled content
// as HTML from our domain on fetch (stored XSS via content-type
// confusion), flagged by security review.
const ContentType = Type.String({
  pattern: "^(audio|video|image)/[a-zA-Z0-9][a-zA-Z0-9.+-]*$",
});

function resolveBucket(alias: "raw" | "media"): string {
  return alias === "raw" ? RAW_BUCKET : MEDIA_BUCKET;
}

const devUploadRoutesEnabled =
  process.env.NODE_ENV === "development" &&
  process.env.ENABLE_DEV_UPLOAD_ROUTES === "true";

if (devUploadRoutesEnabled) {
  app.post(
    "/uploads/presign",
    {
      preHandler: requireAdminSession,
      schema: {
        body: Type.Object({
          bucket: BucketAlias,
          key: Type.String({ minLength: 1 }),
          contentType: ContentType,
        }),
        response: {
          200: Type.Object({
            url: Type.String(),
            bucket: BucketAlias,
            key: Type.String(),
          }),
        },
      },
    },
    async (request) => {
      const { bucket, key, contentType } = request.body;
      const url = await createPresignedUploadUrl({
        bucket: resolveBucket(bucket),
        key,
        contentType,
      });
      return { url, bucket, key };
    },
  );

  app.get(
    "/uploads/playback-url",
    {
      preHandler: requireAdminSession,
      schema: {
        querystring: Type.Object({
          bucket: BucketAlias,
          key: Type.String({ minLength: 1 }),
        }),
        response: {
          200: Type.Object({
            url: Type.String(),
          }),
        },
      },
    },
    async (request) => {
      const { bucket, key } = request.query;
      const url = await createPresignedPlaybackUrl({
        bucket: resolveBucket(bucket),
        key,
      });
      return { url };
    },
  );
}

const port = Number(process.env.PORT ?? 4000);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
