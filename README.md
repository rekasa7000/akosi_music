# Akosi Music

Physical NFC cards that unlock an artist's catalog or a single release —
tap the card, verify ownership, stream the music. See
[`docs/01-claude.md`](docs/01-claude.md) for the full project guide.

## Status

Pre-build, proposal stage. `apps/web`, `apps/api`, and
`packages/database` are scaffolded; `apps/worker` and
`packages/shared` are not yet.

## Layout

```
apps/
  web/      fan app + artist portal (Next.js + shadcn/ui) — scaffolded
  api/      ownership auth, catalog, signed URLs (Fastify) — scaffolded
  worker/   audio transcoding                      — not yet scaffolded
packages/
  database/ Prisma schema + client, shared by api and worker — scaffolded
  shared/   shared types, constants, validation schemas
docs/       project spec — start at 01-claude.md
docker-compose.yml  local dev: Postgres + LocalStack (S3) + Mailpit (email)
```

Full write-up of this layout and the reasoning behind it:
[`docs/10-project-structure.md`](docs/10-project-structure.md).

## Tooling

- Package manager: [pnpm](https://pnpm.io) (workspaces)
- Task runner: [Turborepo](https://turbo.build/repo)

## Getting started

```bash
docker compose up -d                        # starts local Postgres + LocalStack (S3) + Mailpit, one-time per machine
pnpm install                                 # installs all workspace packages from the root
pnpm --filter @akosi/database migrate:dev   # applies DB migrations (first run only)
pnpm --filter @akosi/database seed          # creates the one admin account (first run only)
pnpm dev                                     # turbo run dev — runs every scaffolded app
pnpm build                                   # turbo run build
```

Always install from the repo root (`pnpm install`, or `pnpm add <pkg>
--filter <workspace-name>` for a single app). Don't run `npm install`
or `bun install` inside an individual `apps/*`/`packages/*` folder —
there is exactly one lockfile (`pnpm-lock.yaml`, at the root) and it
should stay that way.

Each app and package is otherwise scaffolded independently as it's
built — see the README in each `apps/*` and `packages/*` folder for
its current status and what belongs there.
