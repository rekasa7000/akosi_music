# Conventions

Engineering conventions by area of the system. These assume the
component breakdown in `03-architecture.md` (web app, API, worker,
database, shared logic) without prescribing folder paths.

---

## Web app (fan app + artist portal)

Serves **two audiences from one codebase**: the public/fan-facing app
(marketing pages, sign up/login, tap landing pages, player, library,
account settings) and the artist portal (gated routes for upload,
catalog management, card configuration, analytics). See
`06-pages-to-design.md` for the full page inventory.

### The tap-landing route is security-sensitive

This route is the entire product. Design decisions here should assume:

- The incoming tap query data (card UID, counter, CMAC) is **untrusted
  input** — never trust it client-side. This page's only job is to
  forward it to the API and render what comes back.
- **Never** fetch or construct a storage URL (S3/CloudFront/GCS)
  directly in the web app. The signed playback URL only ever comes from
  the API response, after the API has verified the tap server-side.
- Handle all outcomes explicitly: unclaimed card → login/signup + claim;
  already-owned card (by this session's user) → player; card owned by
  someone else → a clear error, never a silent failure or a player that
  happens to not load.
- Audio should start within ~1–2 seconds of a valid tap. Don't add
  unnecessary client-side round trips on this path.

### General conventions

- **Always use shadcn/ui for UI components.** The app is scaffolded
  with `shadcn@latest init` (Radix base) — don't hand-roll a component
  or reach for a different component library when a shadcn equivalent
  exists. Add new components with `bunx --bun shadcn@latest add
  <component>`; they land in `components/ui/` as local, owned code, not
  a dependency, so customize them directly once added. This instruction
  is also pinned in `apps/web/AGENTS.md` for AI agents working in that
  app.
- Shared types/validation come from the shared package — don't redefine
  card/track/user shapes locally.
- Artist-portal routes should be gated via middleware, not just hidden
  navigation — treat route-level auth as required, not optional, even
  pre-launch with a handful of invite-only artists.
- Keep the player a separate, reusable component — it's used both on the
  tap-landing route (fresh tap) and the library page (replaying an
  already-claimed card).

---

## API

The **trust boundary** of the entire platform — the one place that
decides whether a tap results in playback.

### Core responsibilities

1. **Ownership auth** — decrypt a card's SDM/SUN message, verify the tap
   counter against the last-seen value (replay protection), and confirm
   the card belongs to the requesting user.
2. **Catalog resolution** — given a verified card, resolve which
   track(s) or release it unlocks.
3. **Signed URL minting** — issue short-lived (5–10 min) signed URLs,
   and nothing else ever does this.
4. **Artist portal endpoints** — upload presign requests, catalog CRUD,
   card provisioning requests, basic analytics queries.
5. **Card claim flow** — bind an unclaimed card to a user account on
   first valid tap + login.

Full sequence: `05-nfc-authentication.md`. Don't reimplement that flow
from memory — read it before touching auth code.

### Non-negotiable rules

- **Every write to card or ownership records goes through the ownership
  service.** No other app, script, or admin tool writes to these
  directly except the provisioning/import pipeline (batch-importing a
  new card manifest), which is a separate, explicitly audited path.
- **The CMAC/counter decryption key is never logged, never returned in
  an API response, and never passed to the frontend.** Only the final
  signed playback URL crosses that boundary.
- **Replay check is mandatory on every tap**, not just on claim. A tap
  with a counter ≤ the last-seen value is rejected outright, even from
  an already-authenticated session.
- Master key / derived key material comes from a secrets manager (AWS
  Secrets Manager / Cloud KMS+Secret Manager) in any real environment —
  never a plaintext env file outside local dev.

### Suggested route shape

```
GET  /tap                    — verify a card tap (uid, ctr, cmac query params)
POST /cards/claim            — bind an unclaimed card to the session user
GET  /library                — list the current user's owned cards
POST /uploads/presign        — presigned upload URL for an artist upload
GET  /catalog/:artistId      — artist's releases/tracks
POST /cards/provision        — (internal/admin) import a batch of card UIDs
GET  /analytics/:artistId    — basic claim/play stats
```

### General conventions

- Strict typing, schema validation on every route (request + response)
  — this is the surface that handles cryptographic verification; loose
  typing here is a real risk, not just style.
- Validation schemas shared with the frontend live in the shared
  package.
- Prefer small, named services (ownership, catalog, signed-URL) over one
  large handler file — this code will get a security review before
  launch and should be easy to audit function-by-function.

---

## Worker (transcoding)

Triggered by a new object landing in the raw uploads bucket (S3 event →
Lambda, or Cloud Storage event → Cloud Run Job / Eventarc, depending on
which stack is chosen — see `04-tech-stack.md`).

### Responsibility

Take whatever an artist uploaded (inconsistent bitrates, sample rates,
formats) and normalize it to one clean streaming format (AAC or Opus)
before it's considered playable.

### Flow

1. Triggered by an upload event in the raw bucket.
2. Downloads the raw file.
3. Runs it through ffmpeg: normalize loudness, re-encode to the target
   format/bitrate.
4. Uploads the result to the processed/private bucket (the one the CDN
   actually serves from).
5. Updates the track's status in the database (`processing` → `ready`).
6. On failure, marks the track `failed` with an error reason — never
   leave a track silently stuck in `processing`.

### Conventions

- Stateless and idempotent — safe to re-run on the same input without
  creating duplicate processed files or corrupting track status.
- ffmpeg invocation should be a small, isolated, testable function —
  don't inline shell calls across the handler.
- Never writes to card or ownership records — this worker only touches
  tracks (and its own processing-status fields).
- Keep processing time reasonable for the artist-portal UX: the artist
  should see a track go from "processing" to "ready" within a few
  minutes for a typical track length, not require a manual refresh
  cycle hours later.

---

## Database package (shared schema/client)

The data model (full detail in `09-data-model.md`) **is** the single
source of truth other parts of the system import from, never duplicate.

### Rules

- **Never duplicate these types by hand elsewhere.** The API and worker
  import the generated client and its types from this package.
- Every schema change ships as a migration, not a manual SQL script
  against the database.
- Card and ownership tables are security-sensitive — any schema change
  here should be reviewed with `05-nfc-authentication.md` open, since
  the ownership model depends on these shapes matching what the
  ownership service expects.
- Keep `Card.releaseId` nullable by design — that nullability *is* the
  Artist-Card-vs-Music-Card distinction (see `02-product.md` § Card
  Types). Don't "clean this up" into two separate tables later without
  updating the docs and the API logic together.

---

## Shared package (types, constants, validation)

Shared logic used by the web app and API (and worker where relevant).

### What belongs here

- Request/response types for API routes consumed by the web app (e.g. a
  tap-verify response shape, a claim-card request shape).
- Validation schemas for anything crossing the web↔API boundary —
  especially the tap flow's query params and responses.
- Shared enums/constants: card status values (`unclaimed`, `claimed`,
  `revoked`), track status values (`processing`, `ready`, `failed`),
  card-type derivation helpers (e.g. "is this an Artist Card" based on
  `releaseId` being null).
- Anything that would otherwise be copy-pasted between the web app and
  API and drift out of sync.

### What does NOT belong here

- Database types/client — those come from the database package.
- Anything cryptographic (key derivation, CMAC decryption) — that stays
  inside the API's ownership service, not in a shared package other
  apps import. Sharing crypto logic into a package the frontend also
  depends on risks it ending up in a client bundle.
- UI components — this is logic/types only.

### Conventions

- Keep this package framework-agnostic so both the web app and API can
  depend on it cleanly.
- Treat anything exported here as public API between apps — changing a
  shape is a cross-app change, not a local one. Check both the web app
  and API for usages before renaming or restructuring an export.

---

## Repo-wide conventions

- TypeScript everywhere, strict mode on.
- Package manager: pnpm. Task runner: Turborepo.
- Environment variables should be documented in an example env file —
  never commit a real one, and never commit the card master key or any
  derived key material anywhere in version control.
