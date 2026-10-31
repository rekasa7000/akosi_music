# Deployment

This doc covers two separate decisions, in order: the **production
launch deploy** (below), sized against the real card volume now known,
and the **early, cost-optimized staging deploy** (further down) used to
get the app reachable before that volume mattered.

## Production launch deploy

Per `07-timeline.md`, cards arrive and get encoded in Apr '27 for a Jun
'27 launch. The business plan is **~1,000 cards at launch, then ~1,000
more every quarter** — this section sizes the backend against that
number rather than guessing.

### The capacity math

A tap only costs the API 2–3 cheap, single-row-indexed lookups —
redeem the card's UID → fetch the release → mint a presigned playback
URL. The audio/video bytes themselves are served directly from object
storage via that presigned URL, never proxied through the API (see
`storage.ts` / the storage-adapter rule in `04-tech-stack.md`), so
media bandwidth never touches API capacity planning at all.

| Scenario | Taps/sec | API requests/sec (×2–3 per tap) |
|---|---|---|
| Realistic: 1,000 cards tapped over days/weeks after a drop | well under 1 | well under 1 |
| Concentrated: all 1,000 tapped within a 10-minute launch window | ~1.7 | ~5 |
| Worst case: a flash-mob tap, all 1,000 within 60 seconds | ~16.7 | ~50 |

Even the worst case is trivial for one small, always-on Node instance,
and the same is true on the database side — a few indexed single-row
Postgres lookups per tap, nothing a shared-CPU managed Postgres
notices. The quarterly repeat doesn't compound this into a scaling
problem either: it's the same ~1,000-card burst shape recurring, not
cumulative concurrent load (cumulative *row count* growth — ~4,000
cards/year — is likewise trivial for an indexed table over several
years).

**Conclusion: at this volume, capacity is not the deciding factor.**
Any reasonable host — the team's existing self-hosted setup or a
managed PaaS — handles it with large headroom. The decision criteria
that actually matter here are:

1. **No cold starts.** A tap is a one-shot, in-the-moment UX ("tap
   card → instant Now Playing") — a platform that can go cold between
   taps (serverless functions: Cloud Run's scale-to-zero, Lambda,
   Vercel functions) risks a multi-second stall on an infrequently
   tapped card, which hurts this specific UX far more than raw
   capacity headroom ever would. This also means the early staging
   deploy's Cloud Run choice below should **not** carry over to
   production as-is — it was picked there for its free tier while
   traffic was near-zero, not for production fit.
2. **Zero-downtime deploys with a migration step**, since the
   quarterly card drop means new catalog data and (occasionally)
   schema changes ship on a recurring cadence, not once.
3. **Ops load matching a part-time team.**

### Recommendation — and a conflict worth resolving

`04-tech-stack.md` / `03-architecture.md` already name **Docker +
Coolify + Traefik, self-hosted** as the team's default, existing setup.
That default already satisfies criterion 1 (always-on, no cold start)
— so the capacity math above does **not**, by itself, argue for moving
off it. If the team is already operating that host day-to-day, staying
on it is a perfectly good fit for 1,000-cards-a-quarter traffic.

The alternative worth naming explicitly: a small always-on instance on
a managed PaaS (**Render** or **Railway**) over heavier AWS
self-managed compute (ECS/Fargate) — Fargate-level orchestration is
unnecessary ops overhead for a single-digit-to-double-digit-req/sec
service, while Render/Railway give the same "no cold start" property
with a simpler deploy story (git push → zero-downtime rollout,
built-in preview/staging environments for testing each quarter's card
batch before it goes live).

**Which of the two wins depends on something math can't answer: does
the team want to keep operating its own Coolify host, or hand that off
to a managed platform?** Pick Coolify (zero new cost, matches existing
ops muscle) unless the team would rather not be the one patching and
monitoring that host long-term, in which case Render is the fallback.

### Production stack (either hosting choice)

| Layer | Pick | Why |
|---|---|---|
| Web + API hosting | Existing Coolify/Traefik host, **or** Render/Railway small instance | See conflict above — always-on either way, no cold start |
| Database | Managed Postgres on the same host (Coolify), or Render/Railway's managed Postgres | Shared-CPU tier is enough per the math above |
| Object storage | Real **AWS S3** (not LocalStack) | Already the intended target per `04-tech-stack.md` Path A; `storage.ts`'s presigned-URL pattern needs no code change, only env vars |
| CDN / signed delivery | Skip at launch | Per `04-tech-stack.md` Path B's logic — add CloudFront only once real traffic, not card count, justifies it |
| Secrets | Coolify's env var store, or the chosen PaaS's secret manager | Never a plaintext `.env` in production, per the key-storage rule in `04-tech-stack.md` |
| CI/CD | GitHub Actions | Build, run `prisma migrate deploy`, then roll out — same pipeline regardless of hosting choice |

### Implementation status

- ⬜ Resolve the Coolify-vs-Render question with the team
- ⬜ Dockerfile for `apps/api` (multi-stage: install → `tsc` build →
  slim runtime image running `node dist/index.js`)
- ⬜ Dockerfile for `apps/web` (standard Next.js production Docker
  pattern)
- ⬜ Real AWS S3 buckets provisioned (`akosi-raw`, `akosi-media`),
  replacing LocalStack
- ⬜ GitHub Actions workflow: build, `prisma migrate deploy`,
  zero-downtime deploy on push to `main`
- ⬜ Load-test the worst-case scenario above (1,000 synthetic taps in
  under a minute) against whichever host is chosen, to confirm the
  math rather than assume it
- ⬜ Admin bootstrap run once against the production database

---

## Early, cost-optimized staging deploy

This documents the hosting decision for getting the app reachable from
outside a local machine **now** — a staging/demo deploy to show
progress and let people other than the admin poke at it. It is not the
production launch architecture (see above): per `07-timeline.md`,
cards don't exist until Apr '27, so this deploy only needs to carry
admin usage and a small amount of browsing traffic, not real NFC
redemption volume.

`04-tech-stack.md` lays out two paths — AWS/self-hosted (Path A,
default) and GCP (Path B, if using Google Cloud credits). This is a
**third variant**: GCP for compute, but swapping GCP's own managed
Postgres and storage for providers with a real permanent free tier,
since the goal here is "deployable for $0," not "deployable on Google
credits." Nothing below forecloses a later move to Path A or full
Path B — see "Switching later" in `04-tech-stack.md`; the same
isolation argument (don't let a specific provider's SDK leak outside
the storage adapter) applies here too, and already holds today (see
below).

## The stack

| Layer | Pick | Why this and not the `04-tech-stack.md` default |
|---|---|---|
| Web + API hosting | **GCP Cloud Run** | Matches Path B. Generous always-free tier (2M requests/mo, 360k GiB-seconds), scales to zero, no server to patch. Both `apps/web` and `apps/api` already build to a plain `next start` / `node dist/index.js` process — no framework adapter needed. |
| Database | **Neon** (not Cloud SQL) | Cloud SQL has no permanent free tier — cheapest instance runs ~$10-15/mo, or burns the one-time 90-day/$300 trial and then bills. Neon's free tier is permanent and serverless (scales to zero like Cloud Run does), which is a better match for near-zero traffic than either Cloud SQL or RDS. |
| Object storage | **Cloudflare R2** (not Cloud Storage / S3) | Free 10GB and, more importantly, **zero egress fees** — this app repeatedly serves audio/video playback, where egress is the cost that actually grows with usage. GCS's free tier is comparable on storage but not on egress. |
| Email (admin OTP codes) | **Resend** | Free tier (100/day, 3000/mo) comfortably covers admin login codes — the only email this app sends right now (see `12-admin-authentication.md`). |
| CI/CD | **GitHub Actions** | Free minutes on the repo's plan; builds both apps and deploys to Cloud Run on push to `main`. |
| Secrets | **GCP Secret Manager** | Free tier (6 active secret versions) covers `JWT_SECRET`, `TOTP_ENCRYPTION_KEY`, `DATABASE_URL`, R2 credentials, and the Resend API key. Mounted into Cloud Run as env vars at deploy time — never committed, never in a plain `.env` in any real environment (per `04-tech-stack.md`'s key-storage rule). |

Explicitly ruled out: **Vercel** for the web app — its Hobby (free)
tier's terms restrict free usage to non-commercial projects, and this
is a commercial product. **Railway** — no permanent free tier, just a
trial credit then flat monthly billing.

## Why no code changes are needed for storage

`apps/api/src/storage.ts` already talks to S3 through the standard AWS
SDK (`@aws-sdk/client-s3`), configured entirely through env vars
(`S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
`S3_BUCKET_RAW`, `S3_BUCKET_MEDIA`) — this is exactly what makes
LocalStack work in dev today (see `10-project-structure.md`). R2
implements the S3 API, so switching from LocalStack to R2 is an env
var change (`S3_ENDPOINT` → the R2 account endpoint, real
`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`, real bucket names), not a
code change. Same logic applies if this ever moves to real AWS S3 or
GCS's S3-interop mode later.

## Accounts needed (the user creates these — can't be done on their
behalf)

| Account | What for | Note |
|---|---|---|
| GCP project, billing enabled | Cloud Run (web + api), Secret Manager | A card on file is required to enable billing even though usage should stay inside the always-free tier at this scale. |
| Neon | Postgres | Free tier project, grab the pooled `DATABASE_URL` connection string. |
| Cloudflare account, R2 enabled | Object storage | Create two buckets (`akosi-raw`, `akosi-media`, matching dev bucket names) and an R2 API token (access key + secret). |
| Resend | SMTP for admin OTP emails | Free tier API key; verify a sending domain (or use their sandbox domain for this early deploy). |

## Env var mapping (dev → this deploy)

| Var | Dev value | This deploy |
|---|---|---|
| `DATABASE_URL` | local Postgres via Docker | Neon pooled connection string |
| `S3_ENDPOINT` | `http://localhost:4566` (LocalStack) | R2 account endpoint (unset entirely if ever moving to real AWS S3 — see the comment already in `apps/api/.env.example`) |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | LocalStack dummy creds | R2 API token |
| `S3_BUCKET_RAW` / `S3_BUCKET_MEDIA` | `akosi-raw` / `akosi-media` | same names, created in R2 |
| `SMTP_HOST` / `SMTP_PORT` | Mailpit (`localhost:1025`) | Resend's SMTP relay |
| `SMTP_FROM` | `admin@akosi.local` | a real address on the verified sending domain |
| `JWT_SECRET` / `TOTP_ENCRYPTION_KEY` | example placeholders | freshly generated, stored only in Secret Manager |
| `ENABLE_DEV_UPLOAD_ROUTES` | `true` | **must be unset or `false`** — this flag hard-disables the unauthenticated storage demo routes outside `NODE_ENV=development`, but don't rely on that alone; the var itself should not be set to `true` anywhere this deploy can read it |
| `NEXT_PUBLIC_API_URL` (web) | `http://localhost:4000` | the deployed Cloud Run API URL |

## Implementation status

- ⬜ Dockerfile for `apps/api` (multi-stage: install → `tsc` build →
  slim runtime image running `node dist/index.js`)
- ⬜ Dockerfile for `apps/web` (multi-stage Next.js build, matching
  Next's standard production Docker pattern)
- ⬜ GitHub Actions workflow — build both images, push to Artifact
  Registry, deploy to Cloud Run on push to `main`
- ⬜ Prisma migration run against the Neon database (`prisma migrate
  deploy`, not `dev` — no interactive prompts in CI)
- ⬜ Admin bootstrap run once against the deployed database
  (`ADMIN_BOOTSTRAP_USERNAME`/`ADMIN_BOOTSTRAP_PASSWORD`, see
  `12-admin-authentication.md`) — one-time, not part of every deploy
- ⬜ The four accounts above created, credentials in Secret Manager
- ⬜ First deploy verified end-to-end (admin login flow, an upload, a
  playback URL actually resolving through R2)

Nothing here is blocked on hardware or the Nov '26–Jun '27 roadmap in
`07-timeline.md` — this is pure infra work that can happen in parallel
with, or ahead of, that schedule.
