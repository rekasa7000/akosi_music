# MVP Phase 0 — Pre-NFC

This describes the first buildable slice of the platform: admin-driven
content upload, playback (audio + video), lyrics/cover art, and
public-vs-password-gated access — all **before** physical NFC cards
exist. Per `07-timeline.md`, card sourcing and encoding don't land
until Apr '27, but the content/playback engine can and should be built
starting now. This phase is designed to slot the eventual card-based
unlock in later without a rewrite — see "How this converges with the
NFC model" below.

## Implementation status

- ✅ `packages/database` — Prisma schema scaffolded (all fields below),
  migrated and verified against local Postgres.
- ✅ Object storage — `apps/api/src/storage.ts`, verified against
  LocalStack (presign → upload → presign → fetch round trip). See
  `10-project-structure.md` for the local dev setup.
- ✅ Admin auth — full flow from `12-admin-authentication.md` (seed →
  first-login email verification → TOTP enrollment → email-or-TOTP on
  every login after), verified end-to-end. `/uploads/presign` and
  `/uploads/playback-url` are now gated behind it.
- ⬜ Release/track CRUD, the password-unlock flow for private releases,
  web UI — not built yet. The two storage demo routes still accept a
  client-supplied bucket/key instead of a server-generated key and a
  trackId-based ownership check — don't build real upload/playback
  logic on top of them until that's addressed (see
  `12-admin-authentication.md` implementation status for the full
  caveat).

## Scope

**In scope for Phase 0:**
- Admin authentication (single role, no self-serve signup)
- Admin uploads audio and video, attaches lyrics and/or cover art
- Public release pages — playable immediately, no login
- Private release pages — gated by a password the admin sets, not a
  per-user account
- Playback delivery via signed URLs (never a direct storage link —
  this invariant from `03-architecture.md` holds even without cards)

**Explicitly deferred (not this phase):**
- Fan accounts, card claiming, card ownership, NFC tap auth
- Self-serve artist signup/portal (admin uploads on artists' behalf
  for now)
- Revenue share / monetization
- Per-user play analytics (a track play is logged, but not tied to a
  fan account yet, since none exist)
- Video transcoding pipeline (Phase 0 validates/stores the uploaded
  file as-is; audio still gets normalized per the existing worker
  plan in `03-architecture.md`)

## How this converges with the NFC model

The core invariant from `01-claude.md` and `05-nfc-authentication.md`
— **a playback link always points at our own domain, never directly
at storage** — holds in Phase 0 too, just with a different
verification step in front of the signed-URL mint:

| | Phase 0 (now) | Later (NFC) |
|---|---|---|
| "Can this viewer play this?" | Release is `PUBLIC`, or viewer has a valid unlock token for this `PRIVATE` release | Card is claimed by this user, tap counter valid |
| Proof the viewer carries | Signed cookie (unlock JWT) | Card's SDM/SUN tap data |
| What issues the signed playback URL | Same API endpoint either way | Same API endpoint either way |

Swapping the verification step later means replacing one check inside
the existing route, not rearchitecting the player, the storage layer,
or the CDN delivery path.

---

## Database schema (Prisma, additive to `09-data-model.md`)

Reuses the entities already defined there — `User`, `Artist`,
`Release`, `Track` — with the additions below. Nothing here
contradicts `09-data-model.md`; see the amendment landed in that file
alongside this doc.

### User (amended)

Adds a password for admin login. Fan-specific auth (magic link,
OAuth, whatever gets chosen later) is still an open question and
doesn't block this.

| Field | Type | Notes |
|---|---|---|
| passwordHash | string? | **new.** Set for `ADMIN` users; null for others until fan auth exists |

### Artist (amended)

| Field | Type | Notes |
|---|---|---|
| userId | string? | **changed from required to optional.** Phase 0 has no self-serve artist login — admin creates an Artist profile without a corresponding live account. Backfilled when self-serve signup ships |

### Release (amended)

| Field | Type | Notes |
|---|---|---|
| visibility | enum: `PUBLIC`, `PRIVATE` | **new.** Default `PUBLIC` |
| passwordHash | string? | **new.** Set only when `visibility = PRIVATE`; hashed (argon2/bcrypt), never stored plain |
| coverImageKey | string? | **new.** Album-level cover art, storage key. Falls back target for tracks with no cover of their own |

### Track (amended)

| Field | Type | Notes |
|---|---|---|
| mediaType | enum: `AUDIO`, `VIDEO` | **new.** Determines player UI and (for now) whether the worker transcodes it |
| lyrics | string? (text) | **new.** Plain text or timed-lyrics JSON — plain text is enough for Phase 0 |
| coverImageKey | string? | **new.** Per-track cover; falls back to `Release.coverImageKey` when null |

`rawStorageKey` / `processedStorageKey` / `status` (`PROCESSING`,
`READY`, `FAILED`) are reused as-is from `09-data-model.md` for both
media types — a video's "processed" file for Phase 0 is just the
validated original, not a transcode.

### PlayEvent (amended)

| Field | Type | Notes |
|---|---|---|
| cardId | string? | **changed from required to optional** — no cards exist yet |
| userId | string? | **changed from required to optional** — no fan accounts yet |
| trackId | string | **changed from optional to required** — the play target, in the absence of a card |

Covers both "play" (audio) and "view" (video) — one event shape, no
separate `ViewEvent` table.

### What's intentionally NOT added yet

`Card` and `CardOwnership` stay exactly as specified in
`09-data-model.md` — unused in Phase 0, ready to wire in once hardware
arrives. No schema churn needed on those two tables when that happens.

---

## Architecture

```
apps/web  → admin UI (login, upload, manage releases/tracks, set
            visibility/password) + public release/player pages
apps/api  → admin auth, upload presign, release/track CRUD,
            password-unlock endpoint, signed playback URL minting
apps/worker → audio transcode (as already planned); video passthrough
            for Phase 0 (validate + move to processed bucket, no
            re-encode)
packages/database → Prisma schema/client (the amendments above)
packages/shared   → Visibility/MediaType enums, upload + unlock
            request/response shapes
```

### Admin auth flow

1. `POST /admin/login { email, password }` — verify against
   `User.passwordHash` (argon2), `role = ADMIN`.
2. On success, set an httpOnly, `Secure`, `SameSite=strict` session
   cookie (signed JWT, short-lived + refresh, or a plain server
   session — either is fine at admin-only scale).
3. All `/admin/*` routes require a valid session via a Fastify
   `preHandler`.

### Upload flow (admin)

1. Admin creates/selects an `Artist` and `Release`.
2. `POST /admin/releases/:id/uploads/presign` — presigned PUT for the
   raw audio/video file (and separately for cover art), same pattern
   as `03-architecture.md`'s artist-upload flow.
3. Admin confirms upload → `Track` row created (`status = PROCESSING`,
   `mediaType` set, `lyrics` optional).
4. Worker picks up the raw-bucket event: audio gets normalized
   (AAC/Opus per existing plan); video is validated and copied to the
   processed bucket as-is. Track flips to `READY` (or `FAILED` with a
   reason).
5. Admin sets `Release.visibility`; if `PRIVATE`, sets a password
   (hashed server-side, never returned in any response).

### Public playback flow

1. `GET /releases/:slug` → release metadata (title, cover, track list
   with lyrics/cover) if `visibility = PUBLIC`.
2. `GET /tracks/:id/play` → mints a short-lived (5–10 min) signed URL
   for the processed file, logs a `PlayEvent`, returns the URL. The
   player never constructs or sees a storage URL directly.

### Private (password) playback flow

1. `GET /releases/:slug` on a `PRIVATE` release returns a "locked"
   state — title/cover only, no track list, no player.
2. `POST /releases/:id/unlock { password }` — verify against
   `Release.passwordHash`. On success, issue a signed cookie (JWT
   payload: list of unlocked `releaseId`s, moderate expiry e.g. 24h).
3. Subsequent `GET /releases/:slug` and `GET /tracks/:id/play` check
   that cookie for this `releaseId` before returning track data /
   minting a signed URL. No valid cookie → same locked response as
   step 1, never a silent partial load.

### Suggested route shape

```
POST /admin/login
POST /admin/logout
GET  /admin/me
POST /admin/artists
POST /admin/releases
PATCH /admin/releases/:id          — visibility, password, cover
POST /admin/releases/:id/uploads/presign
POST /admin/tracks                 — register an uploaded file as a Track

GET  /releases/:slug               — public metadata, or "locked" state
POST /releases/:id/unlock          — password check → unlock cookie
GET  /tracks/:id/play              — access check → signed playback URL
```

---

## Why this doesn't paint the project into a corner

- The password check and the future card-ownership check both answer
  the same question at the same point in the request flow — the
  signed-URL-minting route doesn't change shape, only what gates it.
- `Card`/`CardOwnership` are untouched, so adding NFC support later is
  additive, not a migration of existing data.
- `Release.visibility`/`passwordHash` don't need to be removed when
  cards ship — a release could stay password-unlockable as a fallback
  even after card support exists (e.g. for previews or press access),
  so this isn't throwaway code.
