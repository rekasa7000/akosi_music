import "./env.js";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import fastifyRateLimit from "@fastify/rate-limit";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { adminAuthRoutes } from "./routes/admin-auth.js";
import { adminArtistRoutes } from "./routes/admin-artists.js";
import { adminReleaseRoutes } from "./routes/admin-releases.js";
import { adminTrackRoutes } from "./routes/admin-tracks.js";
import { adminMediaRoutes } from "./routes/admin-media.js";

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
  // @fastify/cors only allows GET,HEAD,POST by default — the catalog
  // routes also use PATCH, which a browser preflight otherwise rejects.
  methods: ["GET", "HEAD", "POST", "PATCH"],
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
await app.register(adminArtistRoutes);
await app.register(adminReleaseRoutes);
await app.register(adminTrackRoutes);
await app.register(adminMediaRoutes);

const port = Number(process.env.PORT ?? 4000);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
