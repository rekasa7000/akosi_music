# Database

The Prisma schema and generated client — the single source of truth
for data shapes, imported by the API and worker. Never duplicate these
types by hand elsewhere.

**Stack:** Prisma 7 (stable — `latest` currently points at an 8.0.0
release candidate; pinned to 7.10.0 deliberately), PostgreSQL.

## Local dev setup

```bash
docker compose up -d        # starts Postgres (+ LocalStack S3), from the repo root
pnpm --filter @akosi/database migrate:dev   # applies migrations, generates the client
```

`.env` (gitignored) holds `DATABASE_URL` pointing at the Postgres
container started by the root `docker-compose.yml`. `.env.example`
documents the shape.

**Scripts:**
```bash
pnpm --filter @akosi/database generate       # regenerate the client after a schema change
pnpm --filter @akosi/database migrate:dev    # create + apply a migration in dev
pnpm --filter @akosi/database migrate:deploy # apply pending migrations (CI/prod)
pnpm --filter @akosi/database studio         # Prisma Studio GUI
```

## Usage from other packages

```ts
import { prisma } from "@akosi/database";

const releases = await prisma.release.findMany();
```

**Read before changing the schema:**
- [`../../docs/09-data-model.md`](../../docs/09-data-model.md) — authoritative schema spec
- [`../../docs/11-mvp-phase0.md`](../../docs/11-mvp-phase0.md) — why several fields exist ahead of the NFC card model
- [`../../docs/08-conventions.md`](../../docs/08-conventions.md) — Database package section
