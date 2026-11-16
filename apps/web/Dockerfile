# Build context is the repo root (this is a pnpm/Turborepo monorepo —
# keep this consistent with apps/api/Dockerfile even though web has no
# workspace package deps today).

FROM node:20-slim AS base
# python3/make/g++: the workspace install pulls in argon2 (a transitive
# dep via @akosi/database) which has no prebuilt binary matching this
# image and falls back to compiling from source — same reasoning as
# apps/api/Dockerfile.
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time,
# not read at container start — must be set here, not just at runtime.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm turbo run build --filter=@akosi/web

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
