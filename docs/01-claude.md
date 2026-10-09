# Music Cards Platform — Project Guide (CLAUDE.md)

This is the main orientation document for Claude Code (or any engineer)
working on this project. The other markdown files listed at the bottom
are the source of truth this guide points into — read them before making
architectural changes.

## What this project is

A platform that sells physical NFC cards. Each card is bound to an artist
(or a specific release) and, once claimed, plays music **only** when
tapped by the phone of its registered owner. Ownership is enforced
cryptographically (NTAG 424 DNA, per-card diversified keys, replay-proof
dynamic tap data), not just by a login screen.

Two card types, same underlying data model:
- **Artist Card** — unlocks an artist's full catalog (`release_id` is null)
- **Music Card** — unlocks a single release (`release_id` is set)

Full product and architecture context: see `02-product.md` and
`03-architecture.md`.

## Conceptual project layout

The system is built as a monorepo with three applications and two shared
packages. See `08-conventions.md` for what belongs in each part of the
system, and `10-project-structure.md` for the actual folder layout now
that the repo is initialized. Conceptually:

- **Web app** — fan-facing app (browse, claim, play, library) and the
  artist portal (upload, catalog, analytics), same codebase, gated routes
- **API** — ownership verification, catalog resolution, signed URL minting
- **Worker** — transcodes artist-uploaded audio into a consistent
  streaming format
- **Database package** — the Prisma schema and client, shared by the API
  and worker
- **Shared package** — shared types, constants, and validation schemas
  used by the web app and API

## Tech stack (summary — full detail in `04-tech-stack.md`)

| Layer | Choice |
|---|---|
| Web app + artist portal | Next.js, TypeScript |
| API | Node.js, Fastify, TypeScript |
| Database | PostgreSQL + Prisma |
| Raw uploads | S3 (or GCS) presigned PUT |
| Transcoding | Lambda/Cloud Run Jobs + ffmpeg |
| Playback delivery | CloudFront / Cloud CDN, signed URLs |
| Hosting | Docker + Coolify + Traefik (or Cloud Run) |
| Card hardware | NTAG 424 DNA (AES-128, SDM/SUN dynamic messaging) |
| Monorepo tooling | pnpm workspaces + Turborepo |

This defaults to the AWS-flavored stack. If the team has committed to GCP
credits instead, see `04-tech-stack.md` for the Cloud Run / Cloud SQL /
Cloud Storage equivalents.

## Core invariant — do not break this

**A card's tap link always points to our own domain, never directly to
storage.** The NDEF record on a card is
`https://<our-domain>/tap?uid=..&ctr=..&cmac=..`. The backend decrypts,
verifies ownership and replay-counter, and only then mints a short-lived
signed URL to the actual audio. Any change that makes a card point
directly at S3/CloudFront/GCS defeats the entire ownership model — never
do this, even for convenience or local testing shortcuts. See
`05-nfc-authentication.md` for the full sequence.

## Where to look for what

| Question | Read |
|---|---|
| "What are we building and why?" | `02-product.md` |
| "What's the full system architecture?" | `03-architecture.md` |
| "What's the tech stack, AWS vs GCP?" | `04-tech-stack.md` |
| "How does the NFC tap/auth flow work?" | `05-nfc-authentication.md` |
| "What pages need to be designed?" | `06-pages-to-design.md` |
| "What's the build timeline?" | `07-timeline.md` |
| "What's the data model / DB schema?" | `09-data-model.md` |
| "What are the coding conventions per app?" | `08-conventions.md` |
| "What's the actual folder/monorepo structure?" | `10-project-structure.md` |
| "What's buildable before NFC cards exist?" | `11-mvp-phase0.md` |
| "How does admin login/MFA work?" | `12-admin-authentication.md` |

## Current project status

Pre-build, proposal stage. Target: start November 2026, launch June 2027.
Most of the system described in these documents does not have working
code yet — these documents are the spec engineering work will fill in.
`11-mvp-phase0.md` describes the first buildable slice (admin upload,
playback, password/public access) that doesn't depend on card hardware
arriving first.
