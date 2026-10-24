# Deployment (early, cost-optimized)

This documents the hosting decision for getting the app reachable from
outside a local machine **now** — a staging/demo deploy to show
progress and let people other than the admin poke at it. It is not the
production launch architecture: per `07-timeline.md`, cards don't exist
until Apr '27 and launch is Jun '27, so this deploy only needs to carry
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
