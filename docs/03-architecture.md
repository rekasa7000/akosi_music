# System Architecture

See also: `04-tech-stack.md` (stack detail + AWS/GCP comparison),
`05-nfc-authentication.md` (the tap/auth sequence in full),
`02-product.md` (actors, card types, monetization),
`07-timeline.md` (build schedule).

## What gets built, and why

| Component | Purpose | Stack |
|---|---|---|
| Web app / PWA | Fan-facing app: browse, claim, play, manage library | Next.js, TypeScript |
| Artist portal | Upload, catalog management, analytics | Same Next.js app, gated routes |
| API | Ownership verification, catalog resolution, signed URL minting | Node.js (Fastify), TypeScript |
| Database | Users, cards, ownership, artists, tracks, play events | PostgreSQL + Prisma |
| Ownership auth service | Decrypts card's SUN message, checks counter, matches card→user | Custom, part of the API |
| Raw upload storage | Artist-uploaded files land here first | S3 (presigned PUT), or GCS |
| Transcode worker | Normalizes uploads to a consistent streaming format | Lambda / ffmpeg (or Cloud Run Job) |
| Playback delivery | Private bucket, only reachable via signed URL | S3 + CloudFront, or GCS + Cloud CDN |
| Mobile shell | Optional native install for a smoother experience — not required for tap-to-play | Capacitor, wrapping the web app |
| Hosting | API and web app | Docker + Coolify + Traefik, or Cloud Run |

---

## High-level flow (actors)

```
Artist  → uploads catalog, sets card type  → Platform
Platform → provisions physical cards        → Card
User    → buys, claims, taps card           → Platform
Platform → verifies tap, streams audio      → User
Platform → logs play, splits revenue        → Artist
```

Two sub-flows worth separating when reasoning about this system:

1. **Tap-to-play flow** — Card → Phone → API (ownership auth) → Database
   (ownership check) → CDN (signed URL) → Phone (stream). This is the
   latency-sensitive, security-critical path. Full detail in
   `05-nfc-authentication.md`.
2. **Artist upload flow** — Artist Portal → S3/GCS raw bucket (presigned
   upload) → transcode worker (triggered by upload event) → processed
   bucket → database (track status `ready`). This path is asynchronous and
   can take a few minutes per track without hurting UX.

---

## Core invariant

**A card's tap link always points to our own domain, never directly to
storage.** This is restated here because it's the one architectural rule
that, if broken, undermines the entire ownership model. The NDEF record
on a card is `https://<our-domain>/tap?uid=..&ctr=..&cmac=..` — never a
direct S3, CloudFront, GCS, or Cloud CDN URL. See
`05-nfc-authentication.md` for why.

---

## Why web-first, not native-first

Web NFC (the browser API letting a webpage actively read a tag) only
works on Android Chrome — iOS Safari has never supported it. But NTAG
424 DNA's SDM (Secure Dynamic Messaging) feature writes the encrypted tap
data directly into an NDEF **URL** record, which both Android and iOS
open automatically at the OS level on tap — no app, no JavaScript
required. This is what makes a pure web app viable across both platforms
for the core tap-to-play mechanic; a native app (via Capacitor) remains a
worthwhile post-launch addition for a smoother, branded experience, not a
prerequisite for the product to work.

---

## Deployment

Default: Docker + Coolify + Traefik, matching the team's existing setup.
If the project draws on Google Cloud credits instead, see
`04-tech-stack.md` for the Cloud Run-based equivalent — the application
code doesn't need to change, only the infra/deploy layer and a handful of
environment variables.
