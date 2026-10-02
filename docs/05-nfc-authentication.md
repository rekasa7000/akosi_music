# NFC Tap Authentication

This is the core mechanic of the whole product — read this before
touching any ownership-verification or `/tap`-route logic.

## The sequence

1. **User taps the card to their phone.** The phone's OS reads the
   card's NDEF record directly — no app or browser tab needs to be open
   first.
2. **That NDEF record is a URL on our own domain**
   (e.g. `https://ourapp.com/tap?uid=...&ctr=...&cmac=...`), not a link
   to a media file anywhere. NTAG 424 DNA's SDM (Secure Dynamic
   Messaging) feature writes a fresh encrypted UID, tap counter, and
   CMAC into that URL's query string on every single tap — the link
   itself changes each time, so a copied/cloned link from one tap is
   useless on the next.
3. **The phone OS opens that URL** — straight into our installed app if
   the user has it (via Android App Links / iOS Universal Links), or
   into the default browser if not. Either path hits the same backend
   endpoint.
4. **Our backend decrypts the query parameters** using the diversified
   key for that card (derived from a securely stored master key + the
   card's UID), and checks the tap counter is higher than the last one
   seen — this blocks replay attacks (someone recording and re-sending
   an old link).
5. **The backend checks the ownership table**: does this card_id belong
   to the logged-in user? If the card hasn't been claimed yet, this tap
   becomes the claim (prompting login/signup first).
6. **If everything checks out**, the backend mints a short-lived signed
   CloudFront/Cloud CDN URL (5–10 minute expiry) for the relevant track
   or catalog, and serves the player page with it.
7. **The page streams audio directly from the CDN** using that signed
   URL — the API server never touches the audio bytes itself, keeping it
   fast and cheap to run at scale.

This design means the security-critical decision (can this tap play
this music) happens once, server-side, and everything downstream —
including the OS opening our URL at all — relies on nothing but a
standard link, which is what makes it work on both Android and iOS
without needing a native app for the tap itself.

## What the user actually sees

- **Card never claimed before** → the page prompts login/signup, then
  binds the card to that account before playing.
- **Card already owned by this user** → the page skips straight to a
  player and audio starts within a second or two of the tap.
- **App installed** → the same URL opens directly into the app's player
  screen instead of a browser tab, for a more native feel — but this is
  a presentation choice, not a functional requirement.

A fourth state that must be handled explicitly, not just implied: **card
already owned by a different user.** This should surface as a clear
error, never a silent failure, a generic 403, or (worst case) a player
that somehow loads anyway.

## Why the URL never points at storage directly

The URL always points at our own domain, so:

- The real location of the audio file can change (S3 → GCS, bucket
  rename, CDN migration) at any time without reprinting or
  reprogramming a single physical card.
- The ownership check is unavoidable — there is no "direct link" anyone
  could extract from a card and bypass verification with.
- Analytics (play-event logging) happen at the one chokepoint every tap
  passes through.

See the **Core invariant** in `01-claude.md` — this rule is restated
there because it's the one thing in this system that must never be
"optimized away."

## Implementation notes

- Decrypt → verify counter → check ownership → mint URL, in that order.
  Don't skip the counter check even for a card already matched to the
  current session — a replayed old link should fail regardless of who's
  logged in.
- Key material (the master key, and anything used to derive a per-card
  key) must never appear in a log line, an error message, or an API
  response. Only the final signed playback URL crosses into the
  response body.
- This flow is the one piece of the system that should get a security
  review before launch (see `07-timeline.md`, May '27 — "QA hardening,
  security review, buffer").
