# Product

## Objective

Build a web-first platform where physical NFC cards, each bound to an
artist's catalog or a specific release, unlock playback exclusively for
the card's registered owner. The platform supports two card types, a
secure ownership-verification flow, and a revenue model that pays
artists per card sold and per stream.

---

## Actors and Their Actions

### Artist
- Registers an artist account (invite-only at launch, self-serve later)
- Uploads tracks/albums through the artist portal (presigned upload, no
  size limits imposed by our server)
- Chooses what a card unlocks: their full catalog (**Artist Card**) or a
  single release (**Music Card**)
- Sets card quantity/edition (e.g., limited run of 500 signed cards)
- Views analytics: cards claimed, plays per track, revenue earned

### User / Fan
- Buys a physical card (from the storefront or a retail partner)
- Claims the card to their account on first tap or QR scan (binds card
  → user permanently, or per the resale policy decided — see Open
  Questions)
- Taps the card to their phone to play
- Manages their card library (which cards they own, what each unlocks)
- Optionally gifts or resells a card, if transfer is supported

### The Card Itself
- Physical NFC card (NTAG 424 DNA recommended) with a printed QR code
  fallback
- Contains a unique chip ID and a diversified cryptographic key (derived
  per-card from a master key, so compromising one card doesn't
  compromise others)
- On each tap, generates a fresh encrypted message (SUN) — never
  broadcasts a static, cloneable value
- Maps to either an artist's full catalog or one specific release, set
  at provisioning time

---

## Card Types

| | Artist Card | Music Card |
|---|---|---|
| Unlocks | Full artist catalog, including future releases | One album/release, fixed content |
| Best for | Superfans, artist merch bundles, tours | Single-release drops, collectibles |
| Price point | Higher | Lower |
| Catalog binding | `artist_id` | `release_id` (belongs to an artist) |

**Data model decision:** every card is modeled against a `release_id`
internally. "Artist Card" simply means a card whose `release_id` is null
(i.e., "unlocks everything by this artist, present and future"). This
avoids a schema split between the two card types later. See
`09-data-model.md` for the implementation.

---

## Monetization

1. **Card sales** — direct margin on physical card production vs. sale
   price. Artist Cards priced at a premium given broader access.
2. **Revenue share with artists** — a percentage of each card sale, and
   optionally a micro-payment per play, paid out to the artist. This is
   the core trust proposition for getting artists to onboard.
3. **Limited editions / collectibles** — numbered or signed card runs at
   premium pricing; scarcity itself becomes a revenue lever.
4. **Resale royalty** (if transfer is supported) — platform takes a cut
   when a card changes hands, similar to a resale royalty model.
5. **Artist analytics tier** — basic play/claim analytics free, deeper
   engagement data as a paid tier for artists or labels.
6. **B2B licensing** — white-label the card + tap-to-play infrastructure
   for labels, event organizers, or merch companies who want their own
   branded card program.

---

## Open Questions

- **Card claim policy:** is a claimed card permanently bound to its
  first owner, or transferable (resale/gifting)? This affects the
  ownership record's shape (single immutable row vs. a history of
  transfers) and whether a transfer/revocation flow needs to exist at
  launch. Not yet decided — confirm before building the claim flow.
