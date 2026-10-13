# Admin Authentication

Design for the admin login flow described in `11-mvp-phase0.md`:
seed a **bootstrap credential** (not a real email) → first login forces
the real admin to set their actual email, verify it, set a real
password, and enroll TOTP (Google Authenticator) → every login after
that offers a choice of email-OTP or TOTP. No self-serve signup — the
only way an admin account comes into existence is the seed step, and
the only way it becomes a *real* admin's account is completing setup.

## Implementation status

**Built and verified end-to-end**, including the full bootstrap chain —
real Postgres, real Mailpit-delivered emails, real TOTP codes via
`otplib` standing in for an authenticator app. Walked through live:
seed → login with `admin`/`admin` → `SET_EMAIL` → submit a real email →
code emailed and verified → `PASSWORD_SETUP` → new password set →
`TOTP_ENROLLMENT` → QR confirmed → session issued. Confirmed afterward
that the bootstrap credentials no longer work (401) and that logging
in with the real email + new password skips straight to
`SELECT_MFA_METHOD` — the account only goes through setup once.

Also verified: a wrong code (401), attempt exhaustion after 5 wrong
codes (429, correct code no longer works once exhausted), and a real
30-concurrent-request race-condition test (see below).

Three things found only by actually running it, not by review:

- **`otplib`'s default TOTP tolerance is tighter than real authenticator
  apps need.** The first live test failed on a *correct* code purely
  because a few seconds passed between generating it and submitting
  it. Fixed with `epochTolerance: 30` in `apps/api/src/auth/totp.ts`.
- **`argon2`, `otplib`, and `nodemailer`'s actual shipped APIs all
  differ from older/remembered versions** — named exports instead of
  a default object (`argon2`), a modern functional API instead of the
  classic `authenticator.*` namespace (`otplib`), and types exported
  directly from the package instead of a separate `@types/nodemailer`
  (now removed). Checked each package's actual `.d.ts`/`.d.cts` before
  writing code against it rather than assuming.
- **`/admin/login`'s `email` field can't be format-validated.** It has
  to accept both the bootstrap value (`"admin"`) and a real email,
  since both get checked against the same `User.email` column — so
  that field is a plain non-empty string, and `/admin/setup/email`
  (where a real address actually matters, since a code gets emailed
  to it) is where `format: "email"` lives instead.

`/uploads/presign` and `/uploads/playback-url` (the storage-wiring
demo routes from `11-mvp-phase0.md`) are gated by `requireAdminSession`
in addition to the existing dev-only opt-in — closes the
"unauthenticated credential minting" half of that security finding.
The other half (client-supplied bucket/key instead of server-generated
keys + trackId-based ownership checks) is still open.

**Race condition found and fixed, proven with a real concurrency test:**
the original `verifyChallengeCode` read `attempts`, checked it against
`MAX_ATTEMPTS`, then incremented it as a separate write — classic
TOCTOU. Firing 30 truly concurrent requests at one challenge (same
wrong code, all in parallel) landed **5** at `401` (invalid_code) and
**25** at `429` (attempts_exhausted) — exactly `MAX_ATTEMPTS`, verified
by reading `attempts` back from Postgres afterward (`5`, not 30).
Fixed by making both the attempt-reservation and the final consumption
atomic `updateMany` calls with the invariant re-asserted in the `WHERE`
clause (`attempts: { lt: MAX_ATTEMPTS }` / `consumedAt: null`), checked
via `result.count`. The same atomic-consume pattern is reused in
`consumePasswordSetupChallenge`, since it's the same class of race.
Also added rate limits (5/min) to every code/credential-submitting
route, 10/min to `/admin/login` and `/admin/login/method`.

Not done: a per-user lockout that spans *across* challenges. The
per-challenge atomic limit closes the actual race; a cross-challenge
lockout is additional defense in depth — deferred below.

**Account-takeover race found and fixed, proven with a parallel-login
test:** the bootstrap credential is shared/known by design, so nothing
stopped two parties from calling `/admin/login` at the same time and
each getting their own independently-valid `EMAIL_VERIFICATION`
challenge for the same user — whoever finished their chain (own email,
own password, own TOTP) would silently take over the account. Proven
live: logged in twice with `admin`/`admin`, got two different
challenge tokens, then confirmed the **first** token was already
rejected (`already_consumed`) by the time the **second** one was used
— closed by `invalidateOtherSetupChallenges`, called every time a new
setup-chain challenge is minted or a step is consumed, so only the
latest chain for a user is ever live.

Fixing this surfaced a second, independent bug while reasoning through
it: `/admin/login`'s gate only checked `emailVerifiedAt`, not
`totpConfirmedAt`. A setup interrupted between email-verify and
TOTP-confirm would have fallen through to ordinary `LOGIN_MFA` on the
next login — issuing a full session via email-OTP alone, with TOTP
never actually confirmed. Fixed by adding a third flag,
`User.passwordSetAt` (tracked separately because `emailVerifiedAt`
and `totpConfirmedAt` alone can't distinguish "needs password" from
"needs TOTP"), and resuming at the exact step that's missing rather
than guessing. Verified live for all three interrupted states:
email-only → resumes at `PASSWORD_SETUP`; email+password → resumes at
`TOTP_ENROLLMENT` (with a fresh secret — the old one was never
activated); all three done → normal `SELECT_MFA_METHOD`.

**MFA bypass via the new column itself, found by security review on
the fix above:** `passwordSetAt` is a new column — any admin row that
completed setup *before* it existed gets `NULL` by default, since
Prisma doesn't backfill new columns. The resume logic then reads that
`NULL` as "still needs password setup" and issues a `PASSWORD_SETUP`
challenge from the password check alone, even for an account with
TOTP already confirmed and trusted — a password reset reachable
without the second factor.

The reviewer's suggested backfill condition
(`emailVerifiedAt IS NOT NULL AND passwordHash IS NOT NULL`) turned out
to have the same blind spot the whole fix was about: `passwordHash` is
non-null even on the bootstrap password, so that condition can't tell
"real password set" apart from "still on bootstrap." Used a precise
signal instead, grounded in this codebase's actual history: TOTP
enrollment has only ever followed a successful password replacement,
so any row with `totpConfirmedAt` set necessarily already had a real
password. Backfilled `passwordSetAt = totpConfirmedAt` for exactly
those rows (migration `20261010042015_backfill_password_set_at`);
left ambiguous rows (`totpConfirmedAt` still null) as `NULL` on
purpose — the safe default there is "ask for password-setup again,"
never "skip it." Verified the backfill SQL against a simulated legacy
row directly.

Added a second layer on top, per the reviewer's broader point ("never
re-enroll/reset without verifying the existing factor"): `/admin/login`
now checks `totpConfirmedAt` before honoring a `PASSWORD_SETUP` resume
— if a trusted second factor already exists, it routes to normal MFA
login instead, regardless of what `passwordSetAt` says. This is pure
defense in depth (the backfill above already makes the violating state
unreachable through any real code path), but it means a *future* bug
reintroducing this gap fails toward "require MFA" rather than toward
"skip it" silently. Verified live by directly constructing a row that
still violates the invariant (`totpConfirmedAt` set, `passwordSetAt`
null) and confirming login routes to `SELECT_MFA_METHOD`, not
`PASSWORD_SETUP`.

---

## Why this shape

Four requirements, each with a reason it's modeled the way it is:

1. **Seed first, no signup.** Matches the existing "invite-only, no
   self-serve" pattern already used for artists (`02-product.md`).
2. **The seed credential is a bootstrap value, not a real identity.**
   `User.email` holds a placeholder like `"admin"` until the real
   admin completes setup — there's no real email to send anything to
   until they provide one, which is the first thing first login asks
   for.
3. **The submitted email isn't trusted until it's verified.**
   `User.email` only gets overwritten *after* the emailed code is
   confirmed — stored as `pendingEmail` on the challenge in the
   meantime. A typo or an abandoned setup flow can't lock the account
   out, because the bootstrap credentials still work until setup
   actually completes.
4. **Password setup happens right after email, before TOTP.** Leaving
   the shared bootstrap password (`"admin"` or whatever was seeded)
   valid indefinitely is a real risk, not a hypothetical one — so
   setup forces a real password before the account is considered set
   up, same as it forces TOTP enrollment.

---

## Schema additions (`packages/database`)

### `User` (amended again)

| Field | Type | Notes |
|---|---|---|
| emailVerifiedAt | DateTime? | Set once, when the admin's real (non-bootstrap) email is confirmed |
| passwordSetAt | DateTime? | Set once the bootstrap password is replaced. Tracked as its own flag — `emailVerifiedAt` + `totpConfirmedAt` alone can't tell "needs password" apart from "needs TOTP," which `/admin/login`'s resume logic needs to know |
| totpSecret | String? | Base32 TOTP secret, **encrypted at rest**. Written at enrollment time, before confirmation |
| totpConfirmedAt | DateTime? | Set only after the admin proves they can generate a valid code |

`emailVerifiedAt`/`passwordSetAt`/`totpConfirmedAt` together are a
3-state resume cursor for `/admin/login`: whichever is the *first*
missing one (in that order) is where the next login resumes, not a
restart from scratch and not a fall-through to normal login.

### `AdminAuthChallenge`

One table covers all four multi-step moments (email setup, password
setup, TOTP enrollment, login MFA) — structurally identical: issue an
opaque token, optionally send/expect a code, expire it, consume it
once.

| Field | Type | Notes |
|---|---|---|
| id | string (cuid) | primary key |
| userId | string | FK → User |
| type | enum: `EMAIL_VERIFICATION`, `PASSWORD_SETUP`, `TOTP_ENROLLMENT`, `LOGIN_MFA` | what this challenge is for |
| method | enum: `EMAIL`, `TOTP`? | implied by `type` for all but `LOGIN_MFA`, which the admin chooses; null for `PASSWORD_SETUP` (no code involved) |
| token | string, unique | high-entropy opaque bearer value (crypto-random, not the row id) |
| codeHash | string? | hashed OTP (argon2) — only set once a code has actually been generated |
| pendingEmail | string? | **`EMAIL_VERIFICATION` only.** The admin-submitted real email, pending confirmation. `User.email` is only overwritten once this is verified |
| attempts | int, default 0 | wrong-code counter; challenge is invalidated after a max (see Security) |
| expiresAt | datetime | 10 min for login-time codes, 30 min for first-login setup steps (more room to go check an inbox, pick a password, scan a QR) |
| consumedAt | datetime? | set once verified/consumed; a consumed or expired challenge can never succeed again |
| createdAt | datetime | |

No separate "pending TOTP secret" column — `User.totpSecret` holds it
from the moment enrollment starts.

---

## Flow

### 1. Seed (one-time, out of band)

```bash
pnpm --filter @akosi/database seed
```

Reads `ADMIN_BOOTSTRAP_USERNAME`/`ADMIN_BOOTSTRAP_PASSWORD` from env —
deliberately not named like an email, since it isn't one. Creates
`User{role: ADMIN, email: <bootstrap username>, passwordHash}` with
`emailVerifiedAt`, `totpSecret`, `totpConfirmedAt` all null. Fails
loudly if an admin already exists.

### 2. First login — set and verify a real email

```
POST /admin/login { email: "admin", password: "admin" }
```
- Verify `passwordHash`.
- `emailVerifiedAt` is null → create an `AdminAuthChallenge`
  (`type: EMAIL_VERIFICATION`, `method: EMAIL`, no code yet — there's
  nowhere to send one until the next step), and invalidate any other
  still-live setup challenge for this user (closes the account-takeover
  race described in Implementation status — the bootstrap credential
  is shared by design, so only the *latest* login's chain may proceed).
- Respond `{ challengeToken, step: "SET_EMAIL" }`.
- If setup was interrupted *after* this step, login resumes at
  whichever of `passwordSetAt`/`totpConfirmedAt` is still missing
  instead of restarting here — see step 5.

```
POST /admin/setup/email { challengeToken, email }
```
- Validate the challenge (type, not consumed/expired) and that `email`
  isn't already used by another user.
- Set `pendingEmail = email`, generate a 6-digit code, hash it into
  `codeHash`, email it to `pendingEmail`, reset `attempts` to 0.
- Respond `{ challengeToken, step: "EMAIL_VERIFICATION" }`.
- **Can be resubmitted** on the same still-valid challenge — a typo
  shouldn't require restarting the whole login.

```
POST /admin/verify-email { challengeToken, code }
```
- Compare the code against `codeHash` (attempt-limited, atomic — see
  Security).
- On success: `User.email = challenge.pendingEmail`,
  `User.emailVerifiedAt = now`, consume the challenge. The bootstrap
  identity (`"admin"`) is retired at this exact moment — it's
  overwritten, not just superseded.
- Immediately create a `PASSWORD_SETUP` challenge and return it in the
  same response: `{ challengeToken, step: "PASSWORD_SETUP" }`.

### 3. First login — set a real password

```
POST /admin/setup/password { challengeToken, password }
```
- Validate the challenge (type `PASSWORD_SETUP`, not consumed/expired),
  consume it atomically (same pattern as the code-verification race
  fix — see Security).
- Hash the new password, overwrite `User.passwordHash` — the bootstrap
  password stops working at this exact moment.
- Immediately start TOTP enrollment (step 4) and return its challenge
  in the same response.

### 4. First login — TOTP enrollment

- Generate a TOTP secret (`otplib`), **encrypt it**, write to
  `User.totpSecret`.
- Build the provisioning URI and render it as a QR code (`qrcode`,
  data-URL PNG) for the admin to scan.
- Create an `AdminAuthChallenge` (`type: TOTP_ENROLLMENT`,
  `method: TOTP`).
- Respond `{ challengeToken, step: "TOTP_ENROLLMENT", qrCodeDataUrl,
  manualEntryKey }`.

```
POST /admin/totp/confirm { challengeToken, code }
```
- Verify the submitted code against `User.totpSecret` (live TOTP
  check, `epochTolerance: 30`).
- On success: `User.totpConfirmedAt = now`, consume the challenge,
  **issue the session cookie** — first-login setup is now fully done.

### 5. Every login after setup — choose a factor

```
POST /admin/login { email, password }
```
Now `email` is the real address and `password` is the one set in step
3. `/admin/login` checks three flags, in order, and resumes at the
first one that's missing — not a restart from `SET_EMAIL` and not a
fall-through to normal login:

| Missing | Resumes at |
|---|---|
| `emailVerifiedAt` | `SET_EMAIL` (step 2) |
| `passwordSetAt` | `PASSWORD_SETUP` directly (step 3 — a fresh challenge, not through email again) |
| `totpConfirmedAt` | `TOTP_ENROLLMENT` directly (step 4 — a fresh secret, the old one was never activated) |
| none missing | `LOGIN_MFA`, below |

All three set → create an `AdminAuthChallenge` (`type: LOGIN_MFA`,
`method: null`).
- Respond `{ challengeToken, step: "SELECT_MFA_METHOD",
  availableMethods: ["EMAIL", "TOTP"] }`.

```
POST /admin/login/method { challengeToken, method }
```
- `EMAIL` → generate a code, hash it, email it. `TOTP` → nothing to
  send. Respond `{ step: "ENTER_CODE" }`.

```
POST /admin/login/verify { challengeToken, code }
```
- `EMAIL` → compare against `codeHash`. `TOTP` → live-verify against
  `User.totpSecret`. On success: consume the challenge, issue the
  session cookie.

### Session, once any flow above completes

httpOnly, `Secure`, `SameSite=strict` cookie (signed JWT, 12h expiry,
no refresh token for an admin-only MVP). A Fastify `preHandler`
(`requireAdminSession`) guards every `/admin/*` route plus the two
storage demo routes.

---

## Route surface

```
POST /admin/login            { email, password }
                              → { challengeToken, step }
POST /admin/setup/email      { challengeToken, email }
                              → { challengeToken, step }
POST /admin/verify-email     { challengeToken, code }
                              → { challengeToken, step }
POST /admin/setup/password   { challengeToken, password }
                              → { challengeToken, step, qrCodeDataUrl?, manualEntryKey? }
POST /admin/totp/confirm     { challengeToken, code }
                              → { step }  (sets session cookie)
POST /admin/login/method     { challengeToken, method }
                              → { step }
POST /admin/login/verify     { challengeToken, code }
                              → { step }  (sets session cookie)
POST /admin/logout
GET  /admin/me
```

`step` is always one of `SET_EMAIL`, `EMAIL_VERIFICATION`,
`PASSWORD_SETUP`, `TOTP_ENROLLMENT`, `SELECT_MFA_METHOD`, `ENTER_CODE`,
`DONE` — the client drives its UI off this field rather than inferring
state itself.

---

## Security

- **`/admin/login`'s `email` field is intentionally not format-validated**
  (plain non-empty string) — it must accept the bootstrap identifier.
  Every request still hits the database (one indexed lookup on a
  unique column — cheap), but that's true either way: a real attacker
  sends plausible-looking emails that would pass format validation
  regardless, so the actual protection against volume abuse is the
  rate limit on that route (10/min per IP), not request-shape
  validation.
- **A submitted email isn't trusted until verified** — `pendingEmail`
  on the challenge, not `User.email`, until the code is confirmed.
- **Every code is single-use and short-lived.** Login-time codes: 10
  minutes. First-login setup steps: 30 minutes each.
- **Codes are hashed, not stored plaintext** — argon2, same as
  passwords.
- **Attempt limits per challenge**, enforced atomically (see
  implementation status) — 5 wrong codes invalidates it.
- **Rate limits on every code/credential-submitting route**, not just
  login.
- **TOTP secret encrypted at rest**, not just hashed. Encryption key
  comes from an env var for local dev; per the precedent set for the
  NFC master key (`04-tech-stack.md`), this moves to a real secrets
  manager/KMS before real deployment.
- **Never log a code, token, password, or TOTP secret.**
- **Email sending sits behind a small mailer interface**, mirroring
  the storage-adapter isolation principle — swap providers without
  touching call sites.

---

## New dependencies (`apps/api`)

| Package | Purpose |
|---|---|
| `argon2` | Password + OTP code hashing |
| `otplib` | TOTP secret generation, provisioning URI, verification |
| `qrcode` | Renders the provisioning URI as a scannable PNG/data-URL |
| `@fastify/jwt` + `@fastify/cookie` | Session issuance/verification |
| `nodemailer` | Sends verification/OTP emails over SMTP |
| `@fastify/rate-limit` | Per-route limits on every challenge-code-submitting endpoint |
| `@fastify/cors` | `apps/web` calls this API cross-origin (different port in dev, a different subdomain in prod) and needs the session cookie to come along — explicit origin allowlist (`WEB_ORIGIN` env, comma-separated) plus `credentials: true` |

## Web UI (`apps/web`)

`/admin/login` renders every step of the flow above as its own form
(`components/admin/admin-login-flow.tsx`), driven entirely by the
`step` field each API response returns — the client never infers
state on its own. `/admin` is the (currently placeholder) dashboard
behind it. Both talk to the API directly from the browser via
`lib/admin-api.ts`, a thin `fetch` wrapper that always sends
`credentials: "include"`.

Styled with a dedicated brand palette (`akosi-bg`/`-surface`/`-fg`/
`-muted-fg`/`-accent`/`-accent-2`, defined in `globals.css` as
role-based tokens that flip under `.dark`, the same pattern shadcn's
own `--background`/`--foreground` already use) rather than the app's
generic theme — supports both light and dark via the existing
`next-themes` setup, with a visible toggle, not just the system
preference. Full design rationale isn't duplicated here; see the
component files themselves.

Verified live end-to-end with Playwright, not just typechecked: the
full bootstrap chain (QR scanned conceptually via the manual-entry key
+ a real generated TOTP code), sign-out, repeat login via both EMAIL
and TOTP, a wrong-password error state, light mode, dark mode, and a
mobile viewport (390px).

One bug only showed up this way: `/admin/logout` is a bodyless POST,
but the client always sent `Content-Type: application/json` with no
body — Fastify's JSON parser rejects that combination with a 400 (not
a CORS error, easy to misdiagnose as one). Fixed by only setting that
header when a request actually has a body.

## Local dev email

Mailpit, added to `docker-compose.yml` alongside Postgres/LocalStack
(SMTP on 1025, web UI + API on 8025) — image pulls cleanly, unlike
MinIO/LocalStack's `:latest` (see `10-project-structure.md`). Used
during manual testing by querying `GET
http://localhost:8025/api/v1/messages` directly instead of opening the
web UI.

---

## Deferred (not this pass)

- **TOTP recovery if the admin loses their device.** Needs its own
  flow (re-verify email, then re-enroll).
- **Backup/recovery codes** (common alongside TOTP).
- **Per-user lockout spanning multiple challenges** — defense in depth
  on top of the per-challenge atomic limit, not required to close the
  race that was actually found.
- **Remembering a preferred MFA method** across logins.
- **Multiple admins.** The seed script's "fail if one already exists"
  guard assumes a single admin — revisit when a second is needed.
- **Explicitly restarting from `SET_EMAIL`** if the admin typo'd their
  real email and already moved past it (e.g. into `PASSWORD_SETUP`) —
  not the same as the resume logic above, which correctly continues an
  *interrupted* setup but has no reason to suspect the email itself was
  wrong. Would need its own "start over" endpoint; current workaround
  is waiting for the in-progress challenge to expire (up to 30 min).
