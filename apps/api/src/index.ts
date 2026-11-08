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
import { adminCardRoutes } from "./routes/admin-cards.js";
import { adminStatsRoutes } from "./routes/admin-stats.js";
import { artistAuthRoutes } from "./routes/artist-auth.js";
import { artistReleaseRoutes } from "./routes/artist-releases.js";
import { artistTrackRoutes } from "./routes/artist-tracks.js";
import { artistMediaRoutes } from "./routes/artist-media.js";
import { publicReleaseRoutes } from "./routes/public-releases.js";
import { publicTrackRoutes } from "./routes/public-tracks.js";
import { publicCardRoutes } from "./routes/public-cards.js";
import { publicArtistRoutes } from "./routes/public-artists.js";
import { publicFeedbackRoutes } from "./routes/public-feedback.js";

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

// CSRF defense-in-depth for the cross-site cookies issued in
// production (session.ts/artist-session.ts/fan-unlock.ts all use
// SameSite=None there, since the web app and API sit on different
// registrable domains — see the comments on those cookies). SameSite
// can no longer stop a forged cross-site request on its own, and
// relying solely on "mutating routes require a JSON body, which
// forces a CORS preflight" is correct today but not structurally
// enforced — a future route that accepts a simple-request body would
// silently lose that protection. Checking Origin explicitly, on every
// state-changing request, doesn't depend on that staying true.
//
// A missing Origin header is let through rather than rejected: CSRF
// requires an attacker-controlled page running in a victim's browser,
// and browsers always send Origin on cross-site state-changing
// requests — so the absence of Origin means this isn't a browser-CSRF
// scenario at all (a server-to-server call, curl, etc.), not an
// attacker hiding one.
const STATE_CHANGING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
app.addHook("onRequest", async (request, reply) => {
  if (!STATE_CHANGING_METHODS.has(request.method)) return;
  const origin = request.headers.origin;
  if (origin && !webOrigins.includes(origin)) {
    return reply.code(403).send({ error: "Origin not allowed." });
  }
});

// Signs both the admin session and the fan-unlock cookie — the fan
// side now gates real content access (per-track cards), not just the
// admin panel, so a silently-accepted default here would let anyone
// who's read this file forge a cookie unlocking any track. Fail at
// startup instead of falling back to a known string (local dev's
// .env already sets a real value, so this never trips there).
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("JWT_SECRET must be set — refusing to start with an insecure default.");
}
await app.register(fastifyJwt, { secret: jwtSecret });
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
await app.register(adminCardRoutes);
await app.register(adminStatsRoutes);
await app.register(artistAuthRoutes);
await app.register(artistReleaseRoutes);
await app.register(artistTrackRoutes);
await app.register(artistMediaRoutes);
await app.register(publicReleaseRoutes);
await app.register(publicTrackRoutes);
await app.register(publicCardRoutes);
await app.register(publicArtistRoutes);
await app.register(publicFeedbackRoutes);

const port = Number(process.env.PORT ?? 4000);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
