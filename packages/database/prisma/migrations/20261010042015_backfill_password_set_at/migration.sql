-- Backfill passwordSetAt for rows that existed before that column did.
--
-- Precise signal, not the broader (and wrong) "emailVerifiedAt IS NOT
-- NULL AND passwordHash IS NOT NULL": passwordHash is non-null even
-- for an account still sitting on the bootstrap password, so that
-- condition can't tell "real password set" apart from "still
-- bootstrap" — using it would mark bootstrap-password accounts as
-- done, the opposite of safe.
--
-- totpConfirmedAt is a correct signal instead: under every code path
-- that has ever existed in this schema, TOTP enrollment only follows
-- a successful consumePasswordSetupChallenge, which replaces the
-- bootstrap password first. So any row with totpConfirmedAt set
-- necessarily already had its password replaced before that moment —
-- backfill passwordSetAt to that same timestamp, a real value, not a
-- fabricated NOW().
--
-- Rows with totpConfirmedAt still null are left as NULL here on
-- purpose. There's no column that can disambiguate "stuck before
-- password-setup" from "already set a real password, stuck before
-- TOTP" for those rows under the old schema — and the safe default
-- for that ambiguity is to ask for password-setup again (redundant at
-- worst), never to skip it.
UPDATE "users"
SET "passwordSetAt" = "totpConfirmedAt"
WHERE "totpConfirmedAt" IS NOT NULL
  AND "passwordSetAt" IS NULL;
