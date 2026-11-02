# Build context is the repo root (this is a pnpm/Turborepo monorepo —
# apps/api depends on packages/database as a workspace package, so the
# whole workspace has to be in the build context, not just apps/api).
# Render's render.yaml for this service sets dockerContext accordingly.

FROM node:20-slim AS base
# openssl: Prisma's query engine dynamically links against it, missing
# on node's slim images by default — its absence fails silently until
# the first DB query at runtime, not at build time. Installed here so
# both the build stage (prisma generate) and runtime stage (prisma
# migrate deploy, the running app) have it, and both stages share this
# same base so the engine binary generated in one matches the other.
# python3/make/g++: argon2 has no prebuilt binary matching this image
# and falls back to compiling from source via node-gyp at install
# time, which needs a build toolchain slim doesn't include by default.
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    openssl python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @akosi/database generate
RUN pnpm turbo run build --filter=@akosi/api

FROM base AS runtime
ENV NODE_ENV=production
# Not pruned to production-only deps: packages/database's `prisma` CLI
# is a devDependency, needed at runtime for Render's Pre-Deploy Command
# (`prisma migrate deploy`), which runs against this built image before
# the new instance takes traffic — pruning devDependencies would break
# that step. Trimming image size is a reasonable later optimization,
# not required to ship correctly.
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
