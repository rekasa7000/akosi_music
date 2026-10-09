# Data Model

This describes the data model conceptually. When implemented, this maps
to a Prisma schema backed by PostgreSQL — the entities, fields, and
relationships below are the authoritative source; the actual schema file
should match this document, not the other way around.

`Card.releaseId` being nullable is a deliberate modeling decision — it is
what distinguishes an Artist Card (null) from a Music Card (set). See
`02-product.md` § Card Types.

**Phase 0 note:** fields marked below as added/changed for the
pre-NFC MVP (admin upload, password-gated releases, no cards or fan
accounts yet) are explained in `11-mvp-phase0.md`. This doc stays the
authoritative full-system schema either way — Phase 0 is a subset plus
a handful of additive fields, not a fork.

---

## Users & Artists

### User
| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| email | string | unique |
| name | string? | optional |
| role | enum: `FAN`, `ARTIST`, `ADMIN` | default `FAN` |
| passwordHash | string? | **Phase 0 addition.** Set for `ADMIN` users (admin login); null for others until fan auth is designed |
| createdAt / updatedAt | datetime | |

Relations: one optional `Artist` profile, many owned `CardOwnership`
rows, many `PlayEvent` rows.

### Artist
| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| userId | string? | unique, FK → User. **Phase 0: nullable** — admin creates artist profiles without a live account; backfilled once self-serve artist signup ships |
| name | string | |
| slug | string | unique |
| bio | string? | |
| invitedAt | datetime | default now |
| approvedAt | datetime? | null until approved |
| createdAt / updatedAt | datetime | |

Relations: many `Release`s, many `Card`s (cards with `releaseId = null`
— Artist Cards — still belong to an artist directly).

---

## Catalog

### Release
| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| artistId | string | FK → Artist |
| title | string | |
| releasedAt | datetime? | |
| visibility | enum: `PUBLIC`, `PRIVATE` | **Phase 0 addition.** Default `PUBLIC` |
| passwordHash | string? | **Phase 0 addition.** Set only when `visibility = PRIVATE`; hashed, never returned by any API response |
| coverImageKey | string? | **Phase 0 addition.** Album-level cover art; fallback for tracks with no cover of their own |
| createdAt / updatedAt | datetime | |

Relations: many `Track`s, many `Card`s (cards with `releaseId` set —
Music Cards — point here).

### Track
| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| releaseId | string | FK → Release |
| title | string | |
| durationSec | int? | |
| trackNumber | int? | |
| mediaType | enum: `AUDIO`, `VIDEO` | **Phase 0 addition.** Drives player UI and worker handling |
| lyrics | string? (text) | **Phase 0 addition.** Plain text for MVP; a timed-lyrics format can replace it later without changing the column's meaning |
| coverImageKey | string? | **Phase 0 addition.** Per-track cover; falls back to `Release.coverImageKey` when null |
| status | enum: `PROCESSING`, `READY`, `FAILED` | default `PROCESSING` |
| rawStorageKey | string? | raw upload bucket key, pre-transcode |
| processedStorageKey | string? | processed bucket key — what gets signed-URL'd |
| failureReason | string? | set when status is `FAILED` |
| createdAt / updatedAt | datetime | |

Relations: many `PlayEvent`s.

---

## Cards & Ownership

Security-sensitive entities. Writes to these should only ever come from
the ownership-verification service, or the explicitly audited card
provisioning/import path. See `05-nfc-authentication.md`.

### Card
| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| uid | string | unique — the physical chip UID (NTAG 424 DNA) |
| artistId | string | FK → Artist |
| releaseId | string? | FK → Release; **null = Artist Card, set = Music Card** |
| status | enum: `UNCLAIMED`, `CLAIMED`, `REVOKED` | default `UNCLAIMED` |
| lastSeenCounter | int | default 0 — anti-replay: last valid SDM tap counter seen |
| editionLabel | string? | e.g. "1/500" for limited runs |
| provisionedAt | datetime | default now |
| createdAt / updatedAt | datetime | |

Relations: one optional `CardOwnership`, many `PlayEvent`s.

### CardOwnership

One active row per claimed card. If transfer/resale is supported later,
this becomes a history table instead of a strict one-to-one — see the
open question in `02-product.md` before changing this shape.

| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| cardId | string | unique, FK → Card |
| userId | string | FK → User |
| claimedAt | datetime | default now |

---

## Analytics / Revenue

### PlayEvent
| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| cardId | string? | FK → Card. **Phase 0: nullable** — no cards exist yet |
| trackId | string | FK → Track. **Phase 0: required** — the play/view target in the absence of a card |
| userId | string? | FK → User. **Phase 0: nullable** — no fan accounts yet |
| playedAt | datetime | default now |

Logged on every successful tap-to-play (later) or play/view through
the public or password-unlocked flow (Phase 0, per
`11-mvp-phase0.md`). One shape covers both audio plays and video
views — no separate `ViewEvent` table. This is the basis for both
artist analytics (plays per track) and revenue-share calculations
once those exist.

---

## Entity relationship summary

```
User 1───? Artist 1───* Release 1───* Track
 │                        │
 │                        └──* Card ──? CardOwnership ──1 User
 │                                │
 └────────────────────────────────┴──* PlayEvent ──* User
```

- A `User` may have one `Artist` profile (optional in Phase 0 — admin
  can create an `Artist` with no linked `User` yet).
- An `Artist` has many `Release`s and many `Card`s.
- A `Release` has many `Track`s and many `Card`s (the Music Cards bound
  to it), and is either `PUBLIC` or password-`PRIVATE` (Phase 0).
- A `Card` has at most one `CardOwnership` (the claiming user).
- A `PlayEvent` references the `Track` played, and optionally the
  `Card` and `User` involved once those exist.
