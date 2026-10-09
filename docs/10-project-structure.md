# Project Structure

This describes the actual repo layout, now that it's initialized.
`08-conventions.md` describes what belongs in each part of the system
conceptually; this doc is the concrete folder map that implements it.

## Monorepo tooling

**pnpm workspaces + Turborepo**, per `04-tech-stack.md` and
`08-conventions.md`. Three root files drive this:

| File | Role |
|---|---|
| `pnpm-workspace.yaml` | Declares `apps/*` and `packages/*` as workspace packages |
| `turbo.json` | Task pipeline (`build`, `dev`, `lint`, `typecheck`, `test`) with dependency ordering across packages |
| `package.json` (root) | Repo-level scripts (`pnpm build`, `pnpm dev`, ...) that fan out via `turbo run`, plus the pinned `packageManager` version |

## Directory layout

```
akosi/
├── apps/
│   ├── web/        fan app + artist portal (Next.js)
│   ├── api/         ownership auth, catalog resolution, signed URLs (Fastify)
│   └── worker/      audio transcoding (Lambda/Cloud Run Job + ffmpeg)
├── packages/
│   ├── database/    Prisma schema + generated client
│   └── shared/      shared types, constants, validation schemas
├── docs/            project spec (this folder)
├── docker-compose.yml  local dev: Postgres + LocalStack (S3)
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── .gitignore
```

This maps directly to the component breakdown in `03-architecture.md`:
web app, API, worker, database package, shared package — five
workspace members total, two of them (`database`, `shared`) consumed
by the other three.

## Current state

- `apps/web` — scaffolded (Next.js + shadcn/ui via `shadcn@latest init
  --base radix --template next`). **Always use shadcn/ui for UI
  components in this app** — pinned in `apps/web/AGENTS.md` (for AI
  agents) and `08-conventions.md` (Web app section).
- `apps/api` — scaffolded (Fastify + TypeScript, with
  `@fastify/type-provider-typebox` for request/response schema
  validation on every route, per `08-conventions.md`). `src/index.ts`
  has `/health`, the full admin auth flow (`src/routes/admin-auth.ts`,
  see `12-admin-authentication.md`), and two storage-adapter demo
  routes (`/uploads/presign`, `/uploads/playback-url`) now gated by
  `requireAdminSession` — real release/track routes (`/tap`,
  `/cards/claim`, ...) still aren't built.
- `packages/database` — scaffolded (Prisma 7 + the schema from
  `09-data-model.md`, including the Phase 0 additions). Uses the
  driver-adapter pattern Prisma 7 requires (`@prisma/adapter-pg` +
  `prisma.config.ts`) rather than a schema-level `datasource.url`.
  Initial migration applied and verified with a real create/read/
  delete round trip against the local Postgres container.
- The object storage adapter lives inside `apps/api` (`src/storage.ts`)
  rather than its own package — only the API needs it so far. Talks to
  the real AWS S3 API (`@aws-sdk/client-s3` + `s3-request-presigner`)
  against LocalStack in dev and real AWS in prod, controlled entirely
  by env vars (`S3_ENDPOINT` set vs. unset) — no code change to swap.
  Verified with a real presigned PUT, upload, presigned GET, and
  fetch-back round trip.
- `apps/worker`, `packages/shared` — still placeholders: a directory
  with a README describing its purpose and linking to the relevant
  spec doc, no `package.json` or framework scaffold yet.

Each app/package is scaffolded independently as it's built — that's
why some are further along than others.

### Local dev infrastructure

`docker-compose.yml` at the repo root starts three services:

| Service | Purpose | Port |
|---|---|---|
| `postgres` | Local Postgres for `packages/database` | 5432 |
| `localstack` | Emulates real AWS S3 (not MinIO — see below) | 4566 |
| `mailpit` | SMTP catcher for admin-auth emails (`12-admin-authentication.md`) | 1025 (SMTP), 8025 (web UI + API) |

`localstack-init` is a one-shot job that creates the two buckets
(`akosi-raw`, `akosi-media`) on startup. Start everything with:

```bash
docker compose up -d
```

**Why LocalStack and not MinIO:** MinIO's official Docker images are
no longer freely pullable (`docker.io/minio/minio` and
`quay.io/minio/minio` both reject anonymous pulls as of this writing —
a real registry/licensing change, not an environment issue here).
LocalStack is also arguably the better fit regardless, since it
emulates the actual AWS S3 API rather than a separate S3-compatible
product — the storage adapter code in `apps/api/src/storage.ts` needs
zero changes to point at real AWS later, just unset `S3_ENDPOINT`.

**Why pinned to `localstack/localstack:3.8`, not `:latest`:** the
`:latest` tag currently resolves to a 2026.9.1 build that refuses to
start community-edition services without a paid `LOCALSTACK_AUTH_TOKEN`
license. `3.8` is the last tag confirmed to run S3 fully free.

### Package manager: standardized on pnpm

`apps/web` was initially scaffolded with bun (`bunx --bun shadcn@latest
init`) and `apps/api` with npm, which temporarily left three different
package managers in play against one `pnpm-workspace.yaml`. Resolved:
both apps' `node_modules` and app-level lockfiles (`bun.lock`,
`package-lock.json`) were removed and `pnpm install` was run from the
repo root, which picked up all three workspace members (`@akosi/web`,
`@akosi/api`, root) and produced a single root `pnpm-lock.yaml` — now
the only lockfile in the repo. Verified with `pnpm turbo run build`
across both apps.

Going forward: always install from the repo root with `pnpm install`
(or `pnpm add <pkg> --filter <workspace-name>` for a single
app/package), never `npm install` or `bun install` inside an
individual `apps/*`/`packages/*` folder — that recreates a competing
lockfile and defeats the point of a shared workspace lockfile.

### Package APIs keep drifting from remembered versions

Hit a third time while building admin auth: `argon2`, `otplib`, and
`nodemailer`'s actual shipped APIs (named exports, a modern functional
API, types bundled in the package itself) all differ from
older/assumed versions — and `otplib`'s default TOTP tolerance is
tighter than real authenticator apps need, which only showed up by
actually running the flow, not by reading the code. Full detail in
`12-admin-authentication.md`'s implementation status. General lesson
reinforced: check a package's actual `.d.ts`/`.d.cts` before writing
against it, and manually drive a flow end-to-end rather than trusting
typecheck alone — this repo has now hit real-API-drift three separate
times (Prisma 7's config changes, the AWS SDK checksum default below,
and this).

### AWS SDK v3 gotcha: presigned URLs and checksums

By default, `@aws-sdk/client-s3` attaches an `x-amz-checksum-crc32`
query param to presigned PUT URLs, computed against an *empty* body
(since the real body isn't known at presign time). Any real upload
then fails checksum validation against that stale value. Fixed by
setting `requestChecksumCalculation: "WHEN_REQUIRED"` on the `S3Client`
constructor in `apps/api/src/storage.ts` — worth knowing if this
trips up the worker's S3 client later too.

## Why `worker` exists alongside `web` and `api`

The question that shaped this layout only covered naming for the
backend/frontend split (`apps/api` + `apps/web`, chosen over
`apps/backend`/`apps/frontend` or top-level `server`/`client`). The
third app, `apps/worker`, wasn't part of that choice — it's required
independently by `03-architecture.md`, which splits the system into
**three** applications (web, API, worker) plus two shared packages, not
two. The transcode worker runs on a different trigger (storage upload
events) and a different lifecycle (async, no HTTP surface) than the
API, so it's kept as its own workspace member rather than folded into
`apps/api`.

## Naming convention

| Folder | Package name (once scaffolded) | Why |
|---|---|---|
| `apps/web` | `@akosi/web` | Chosen over `frontend` — shorter, matches `apps/api` |
| `apps/api` | `@akosi/api` | Chosen over `backend` — matches Fastify route terminology used in `08-conventions.md` |
| `apps/worker` | `@akosi/worker` | Matches the "worker" terminology used throughout `03-architecture.md` and `08-conventions.md` |
| `packages/database` | `@akosi/database` | Matches "Database package" in `08-conventions.md` |
| `packages/shared` | `@akosi/shared` | Matches "Shared package" in `08-conventions.md` |

Not a hard requirement — rename before scaffolding if a different
convention is preferred, since nothing depends on these names yet.

## What to read before scaffolding each app

See each folder's own README — every `apps/*` and `packages/*`
directory links back to the specific docs that matter before writing
code there (e.g. `apps/api/README.md` points at
`05-nfc-authentication.md` before anything touches ownership auth).
