# API

The trust boundary of the platform: ownership verification (NFC tap
auth), catalog resolution, and signed playback URL minting. Nothing
else mints signed URLs.

Scaffolded with Fastify + TypeScript, using
[`@fastify/type-provider-typebox`](https://github.com/fastify/fastify-type-provider-typebox)
for request/response schema validation — required per
`08-conventions.md` ("Strict typing, schema validation on every
route"). `src/index.ts` has `/health`, the full admin auth flow, and
two object-storage demo routes; real catalog routes (`/tap`,
`/cards/claim`, etc.) aren't built yet.

**Stack:** Node.js, Fastify, TypeScript, TypeBox, Prisma (via
`@akosi/database`), AWS S3 SDK v3 (via LocalStack in dev), argon2,
otplib (TOTP), nodemailer (via Mailpit in dev).

**Scripts:**
```bash
pnpm dev        # tsx watch src/index.ts
pnpm build      # tsc -> dist/
pnpm start      # node dist/index.js
pnpm typecheck
```

## Local dev setup

```bash
docker compose up -d                          # from the repo root: Postgres, LocalStack, Mailpit
pnpm --filter @akosi/database migrate:dev     # first run only
pnpm --filter @akosi/database seed            # creates the bootstrap admin account
pnpm dev
```

The seeded account is a **bootstrap credential** (`ADMIN_BOOTSTRAP_USERNAME`/
`ADMIN_BOOTSTRAP_PASSWORD` in `packages/database/.env`, default
`admin`/`admin`) — not a real email. Logging in with it walks through
first-time setup (real email → verify → real password → TOTP) before
issuing a session; see Admin authentication below.

Mailpit's web UI (`http://localhost:8025`) shows every email the
admin-auth flow sends — verification codes, login OTPs — without
needing a real provider.

## Admin authentication

Full design in [`../../docs/12-admin-authentication.md`](../../docs/12-admin-authentication.md).
Seed-only account creation (no signup) with a bootstrap credential,
not a real email — first login forces setting a real email (verified
by emailed code), a real password, and TOTP enrollment before issuing
a session. Every login after that offers a choice of email-OTP or
TOTP. Verified end-to-end manually, including a real concurrency test
(see that doc's implementation status for what that uncovered).

```
POST /admin/login            { email, password }
POST /admin/setup/email      { challengeToken, email }
POST /admin/verify-email     { challengeToken, code }
POST /admin/setup/password   { challengeToken, password }
POST /admin/totp/confirm     { challengeToken, code }
POST /admin/login/method     { challengeToken, method }
POST /admin/login/verify     { challengeToken, code }
POST /admin/logout
GET  /admin/me
```

`src/auth/session.ts`'s `requireAdminSession` is the `preHandler` any
new `/admin/*` route (or anything else that needs an authenticated
admin) should use.

## Object storage

`src/storage.ts` is the only place in this app that imports
`@aws-sdk/*` directly, per the storage-adapter guidance in
`04-tech-stack.md`. Talks to real AWS S3 either way — `S3_ENDPOINT`
set (LocalStack, in dev) vs. unset (real AWS) is the only difference.

`.env.example` documents `S3_ENDPOINT`, `S3_REGION`,
`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`, and the two bucket names
(`akosi-raw`, `akosi-media`).

**`POST /uploads/presign`** and **`GET /uploads/playback-url`** prove
the adapter works end to end (presigned PUT → real upload → presigned
GET → fetch back, verified manually). Both are now gated behind
`requireAdminSession`, plus a separate dev-only opt-in
(`ENABLE_DEV_UPLOAD_ROUTES=true` and `NODE_ENV=development`, both
required, defaults closed). **Still not the real fix** — the client
names an arbitrary bucket/key instead of the server generating the
key and resolving playback through a `trackId` + release-visibility/
ownership check. Don't build real upload/playback logic on top of
these two routes before that's addressed.

**Read before building here:**
- [`../../docs/05-nfc-authentication.md`](../../docs/05-nfc-authentication.md) — don't reimplement this flow from memory
- [`../../docs/08-conventions.md`](../../docs/08-conventions.md) — API section
- [`../../docs/09-data-model.md`](../../docs/09-data-model.md)
- [`../../docs/12-admin-authentication.md`](../../docs/12-admin-authentication.md)
