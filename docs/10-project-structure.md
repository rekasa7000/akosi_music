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
  has a minimal `/health` route proving the type-provider wiring —
  verified with `pnpm build` and a live request. Real routes
  (`/tap`, `/cards/claim`, ...) aren't built yet.
- `apps/worker`, `packages/database`, `packages/shared` — still
  placeholders: a directory with a README describing its purpose and
  linking to the relevant spec doc, no `package.json` or framework
  scaffold yet.

Each app/package is scaffolded independently as it's built — that's
why some are further along than others.

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
