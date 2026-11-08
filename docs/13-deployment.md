# Deployment

**Decided stack: Vercel Pro (web) + Render (API) + Neon (Postgres) +
Cloudflare R2 (storage) + Gmail via SMTP (email).** This is the real
production deploy, live from day one — not a temporary staging setup
replaced later. The sections below explain why each piece was picked
and what's left to actually stand it up.

## Why this combination, not `04-tech-stack.md`'s default

`04-tech-stack.md` / `03-architecture.md` name **Docker + Coolify +
Traefik, self-hosted** as the team's default. This deploy deviates from
that default on every layer, for reasons specific to this project, not
because the default is wrong in general:

- **Web on Vercel**, not Coolify — the web app's hosting cost is
  already covered independent of this project's budget, and Vercel is
  Next.js's native platform (PR preview deploys, zero-config builds).
  Vercel's Hobby (free) tier is off-limits for a commercial product
  per its Terms of Service (confirmed current as of Oct 2026) — this
  deploy uses a **Pro** subscription, which is explicitly licensed for
  commercial use, so that restriction doesn't apply here.
- **API on Render**, not Coolify — once web is off Coolify, the API
  alone costs ~$7/month on Render's `0.5c-512mb` plan (the old
  "Starter" tier's resource-slug name post-rename), which is cheap
  enough that the "keep operating our own host" argument for Coolify
  (made in an earlier draft of this doc) no longer carries much
  weight. Render gives zero-downtime git-push deploys without
  maintaining a host.
- **Storage on Cloudflare R2, not AWS S3** — deviates from
  `04-tech-stack.md` Path A's default pick. R2's permanent free tier
  (10GB) plus **zero egress fees ever** fits this app's shape
  (streaming audio/video, where egress is the cost that scales with
  usage) better than S3's pay-per-GB egress. `apps/api/src/storage.ts`
  already talks to S3 through the standard AWS SDK, configured
  entirely through env vars (`S3_ENDPOINT`, `S3_REGION`,
  `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_RAW`,
  `S3_BUCKET_MEDIA`) — R2 implements the S3 API, so this is an env var
  change, not a code change. Same would be true of a later move to
  real AWS S3.
- **Email via Gmail's SMTP relay (`smtp.gmail.com`)**, not a
  transactional provider like Resend or SES — `apps/api/src/auth/mailer.ts`
  already speaks SMTP through `nodemailer` (that's how it reaches
  Mailpit in dev); Gmail is a drop-in replacement, an env var change
  (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`), not a rewrite.
  Auth is a Gmail **App Password** (16 characters, requires 2-Step
  Verification on the account), not the account's login password.
  Chosen over a dedicated provider because the one email this app
  sends today (admin login codes) doesn't need deliverability
  tooling, open tracking, or webhooks — if volume or deliverability
  ever becomes a problem, a provider is a `mailer.ts` + env var swap
  away, same as this swap was.

## The capacity math (why Render's smallest tier is enough)

Per `07-timeline.md`, the business plan is **~1,000 cards at launch,
then ~1,000 more every quarter**. A tap only costs the API 2–3 cheap,
single-row-indexed lookups — redeem the card's UID → fetch the release
→ mint a presigned playback URL. The audio/video bytes themselves are
served directly from R2 via that presigned URL, never proxied through
the API, so media bandwidth never touches API capacity planning.

| Scenario | Taps/sec | API requests/sec (×2–3 per tap) |
|---|---|---|
| Realistic: 1,000 cards tapped over days/weeks after a drop | well under 1 | well under 1 |
| Concentrated: all 1,000 tapped within a 10-minute launch window | ~1.7 | ~5 |
| Worst case: a flash-mob tap, all 1,000 within 60 seconds | ~16.7 | ~50 |

Even the worst case is trivial for Render's smallest always-on tier,
and the same is true on the database side — a few indexed single-row
Postgres lookups per tap, nothing a shared-CPU Neon instance notices.
The quarterly repeat doesn't compound this into a scaling problem
either: it's the same ~1,000-card burst shape recurring, not
cumulative concurrent load.

The one thing capacity math doesn't cover, and the actual reason
Render (not a scale-to-zero platform) was picked for the API: **no
cold starts.** A tap is a one-shot, in-the-moment UX ("tap card →
instant Now Playing") — a platform that goes cold between taps
(Cloud Run, Lambda, Vercel serverless functions) risks a
multi-second stall on an infrequently tapped card, which hurts this
specific UX far more than raw capacity headroom ever would.

## The stack

| Layer | Pick | Why |
|---|---|---|
| Web hosting | **Vercel Pro** | Native Next.js platform; cost isn't a factor for this project's budget. See ownership note below. |
| API hosting | **Render** (`0.5c-512mb` plan) | Always-on, no cold start, ~$7/mo, zero-downtime git-push deploys |
| Database | **Neon** | Permanent free tier (not a trial), works with Prisma via `DATABASE_URL` exactly like local Postgres |
| Object storage | **Cloudflare R2** | Permanent free 10GB, zero egress fees — see above |
| Email | **Gmail**, via SMTP | Free, no signup/verification beyond the Gmail account itself; comfortably covers admin login codes, the only email this app sends today |
| Secrets | Render's and Vercel's own env var stores | Never a plaintext `.env` in production, per the key-storage rule in `04-tech-stack.md` |
| CI/CD | Native git-push deploys on both platforms | Neither Vercel nor Render needs a custom GitHub Actions pipeline for deploys — Render supports a **Pre-Deploy Command** (runs `prisma migrate deploy` before the new instance takes traffic), which covers the one thing that actually needs an explicit step |

### A note on hosting ownership

The Vercel Pro subscription this deploy uses belongs to the person
running this project personally, with its cost reimbursed by a third
party (kloudtech) — not held under kloudtech's own account. That
matters operationally: ownership and admin access to the live web
deployment stay with the project, not a vendor, so there's no
continuity risk if that reimbursement arrangement ever changes.

## Accounts needed (created by whoever owns this deploy — can't be done on their behalf)

| Account | What for | Note |
|---|---|---|
| Vercel, Pro plan | Web hosting | Root Directory set to `apps/web` in the project's settings — see `apps/web/vercel.json` for the monorepo build config |
| Render | API hosting | `0.5c-512mb` plan (always-on); connect the GitHub repo, set Root Directory to `apps/api` |
| Neon | Postgres | Free tier project, grab the pooled `DATABASE_URL` connection string |
| Cloudflare, R2 enabled | Object storage | Create two buckets (`akosi-raw`, `akosi-media`, matching dev bucket names) and an R2 API token (access key + secret) |
| Gmail | SMTP relay for admin OTP emails | Enable 2-Step Verification, then generate a 16-character App Password at https://myaccount.google.com/apppasswords — that password (not the account's login password) is `SMTP_PASSWORD` |

## Env var mapping (dev → production)

| Var | Dev value | Production |
|---|---|---|
| `DATABASE_URL` | local Postgres via Docker | Neon pooled connection string |
| `S3_ENDPOINT` | `http://localhost:4566` (LocalStack) | R2 account endpoint |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | LocalStack dummy creds | R2 API token |
| `S3_BUCKET_RAW` / `S3_BUCKET_MEDIA` | `akosi-raw` / `akosi-media` | same names, created in R2 |
| `SMTP_HOST` / `SMTP_PORT` | Mailpit (`localhost:1025`) | Gmail's SMTP relay (`smtp.gmail.com`, port 587) |
| `SMTP_USER` / `SMTP_PASSWORD` | unset (Mailpit takes unauthenticated connections) | the Gmail address and its 16-character App Password |
| `SMTP_FROM` | `admin@akosi.local` | the same Gmail address |
| `JWT_SECRET` / `TOTP_ENCRYPTION_KEY` | example placeholders | freshly generated, stored only in Render's env var store |
| `ENABLE_DEV_UPLOAD_ROUTES` | `true` | **must be unset or `false`** — this flag hard-disables the unauthenticated storage demo routes outside `NODE_ENV=development`, but don't rely on that alone; the var itself should not be set to `true` anywhere this deploy can read it |
| `WEB_ORIGIN` (api) | `http://localhost:3000,http://localhost:3001` | the deployed Vercel production URL (and any preview URLs that need API access) |
| `NEXT_PUBLIC_API_URL` (web) | `http://localhost:4000` | the deployed Render API URL |

## Implementation status

- ✅ `apps/web/vercel.json` — Vercel build config for the monorepo
- ✅ `apps/api/Dockerfile` — multi-stage, build-verified locally
  (`docker build` + `docker run` against the real local Postgres/
  LocalStack/Mailpit stack, confirmed DB queries and presigned URL
  generation both work from inside the container). Not pruned to
  production-only dependencies — `prisma`, a devDependency, is needed
  at runtime for the Pre-Deploy Command below, so trimming the image
  needs more care than a blind `pnpm prune --prod`.
- ✅ `render.yaml` — Blueprint config: Docker runtime, health check at
  `/health`, Pre-Deploy Command runs `prisma migrate deploy`
- ⬜ Render service actually created from the Blueprint (needs a
  Render account — see Accounts needed below)
- ⬜ Vercel project imported, Root Directory `apps/web`,
  `NEXT_PUBLIC_API_URL` set (needs the Render API URL first)
- ⬜ Real R2 buckets provisioned (`akosi-raw`, `akosi-media`),
  replacing LocalStack
- ⬜ `WEB_ORIGIN` on the API updated once the Vercel URL exists
- ⬜ Admin bootstrap run once against the production database
  (`ADMIN_BOOTSTRAP_USERNAME`/`ADMIN_BOOTSTRAP_PASSWORD`, see
  `12-admin-authentication.md`) — one-time, not part of every deploy
- ⬜ The five accounts above created
- ⬜ First deploy verified end-to-end (admin login flow, an upload, a
  playback URL actually resolving through R2)
- ⬜ Load-test the worst-case scenario above (1,000 synthetic taps in
  under a minute), to confirm the math rather than assume it

Nothing here is blocked on hardware or the Nov '26–Jun '27 roadmap in
`07-timeline.md` — this is pure infra work that can happen in parallel
with, or ahead of, that schedule.
