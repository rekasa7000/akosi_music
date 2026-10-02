# Tech Stack

Two viable infra paths exist for this project: the **AWS/self-hosted
default** (matches the team's existing stack) and a **GCP path** (if the
project draws on available Google Cloud credits). Application code
(Next.js, Fastify, Prisma) doesn't change between them — only the
infra/storage/deploy layer does.

## Application layer (same either way)

| Layer | Choice |
|---|---|
| Web app + artist portal | Next.js, TypeScript |
| API | Node.js, Fastify, TypeScript |
| Database ORM | Prisma |
| Monorepo tooling | pnpm workspaces + Turborepo |
| Mobile shell (post-launch) | Capacitor, wrapping the Next.js app |

## Card hardware & cryptography (same either way)

| Component | Choice |
|---|---|
| NFC chip | NXP NTAG 424 DNA — AES-128, SDM/SUN dynamic messaging |
| Key management | Diversified per-card AES key, derived from a securely stored master key |
| Key storage | A dedicated secrets manager / KMS — never a plaintext `.env` in any real environment |

---

## Path A: AWS / self-hosted (default)

| Layer | Choice |
|---|---|
| Database | PostgreSQL (self-hosted or RDS-style) |
| Raw uploads | S3 (presigned PUT) |
| Transcoding | Lambda + ffmpeg, triggered by an S3 event |
| Playback delivery | CloudFront + S3, signed URLs |
| Hosting | Docker + Coolify + Traefik (team's existing setup) |
| Key storage | AWS Secrets Manager / KMS |
| CI/CD | GitHub Actions |

This is the default assumed throughout `03-architecture.md` and
`08-conventions.md`, since it matches infrastructure the team already
runs.

---

## Path B: Google Cloud (if using GCP credits)

| What you need | AWS version | GCP equivalent | Notes |
|---|---|---|---|
| API backend + web app hosting | Docker + Coolify + Traefik | **Cloud Run** | Serverless containers, autoscales to zero, no server to patch — a better fit for a part-time team than self-managing a host |
| Raw + processed audio storage | S3 | **Cloud Storage** | Same presigned-upload pattern (V4 signed URLs) for artist uploads |
| Signed playback delivery | CloudFront signed URLs | **Cloud CDN + signed URLs**, or Cloud Storage signed URLs directly at MVP scale | Can skip Cloud CDN entirely at launch and add it once traffic justifies it |
| Transcode worker | Lambda + ffmpeg | **Cloud Run Jobs** or **Cloud Functions (2nd gen)**, triggered via Eventarc on a Cloud Storage upload | Same "upload triggers a job" pattern |
| Database | RDS-style Postgres | **Cloud SQL for PostgreSQL** | Prisma works against it identically |
| Key management | AWS Secrets Manager / KMS | **Cloud KMS** + **Secret Manager** | A genuine upgrade — dedicated key management for the one thing in this system that can't leak |
| CI/CD | GitHub Actions | **Cloud Build**, or keep GitHub Actions and deploy to Cloud Run from it | No need to switch if the team is already comfortable with GitHub Actions |
| Logging / monitoring | — | **Cloud Logging / Cloud Monitoring** | Generous free tier even outside the credits |

### Before committing to Path B

Confirm **when the credits expire and how much is available**. Startup
cloud credit grants (e.g. Google for Startups Cloud Program) are
typically time-boxed — commonly a year or two, not permanent. This
doesn't change what to build now, but it matters for who pays the bill
after launch, since June-launch traffic will still be small but the
credits clock doesn't wait for it to grow.

### Switching later

Because the application layer is identical between paths, this decision
is not permanent-or-nothing — the harder-to-reverse part is wherever card
UID manifests and signed-URL logic reference a specific provider's SDK.
Keep that isolated behind a small storage-adapter interface in the API
rather than calling AWS or GCP SDKs directly throughout the codebase, so
a later switch (in either direction) stays contained.

---

## Which path is the default?

**AWS/self-hosted**, unless the team explicitly commits to GCP. If so,
update environment configuration with the GCS/Cloud SQL/Cloud Run
variables from Path B above and note the decision wherever environment
variables are documented for the project.
