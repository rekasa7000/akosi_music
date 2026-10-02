# Data Model

This describes the data model conceptually. When implemented, this maps
to a Prisma schema backed by PostgreSQL — the entities, fields, and
relationships below are the authoritative source; the actual schema file
should match this document, not the other way around.

`Card.releaseId` being nullable is a deliberate modeling decision — it is
what distinguishes an Artist Card (null) from a Music Card (set). See
`02-product.md` § Card Types.

---

## Users & Artists

### User
| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| email | string | unique |
| name | string? | optional |
| role | enum: `FAN`, `ARTIST`, `ADMIN` | default `FAN` |
| createdAt / updatedAt | datetime | |

Relations: one optional `Artist` profile, many owned `CardOwnership`
rows, many `PlayEvent` rows.

### Artist
| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| userId | string | unique, FK → User |
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
| cardId | string | FK → Card |
| trackId | string? | FK → Track |
| userId | string | FK → User |
| playedAt | datetime | default now |

Logged on every successful tap-to-play. This is the basis for both
artist analytics (plays per track) and revenue-share calculations.

---

## Entity relationship summary

```
User 1───? Artist 1───* Release 1───* Track
 │                        │
 │                        └──* Card ──? CardOwnership ──1 User
 │                                │
 └────────────────────────────────┴──* PlayEvent ──* User
```

- A `User` may have one `Artist` profile.
- An `Artist` has many `Release`s and many `Card`s.
- A `Release` has many `Track`s and many `Card`s (the Music Cards bound
  to it).
- A `Card` has at most one `CardOwnership` (the claiming user).
- A `PlayEvent` references the `Card`, the `Track` played, and the
  `User` who played it.
