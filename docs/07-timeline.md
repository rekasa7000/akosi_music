# Timeline

**Engineering start: November 2026. Target launch: June 2027.** Part-time
engagement.

| Month | Focus |
|---|---|
| Nov '26 | Infra setup (repo, CI/CD, hosting), core DB schema, backend skeleton |
| Dec '26 | Ownership auth service, NFC encoding R&D (test NTAG 424 DNA cards, key diversification) |
| Jan '27 | Web app MVP + QR fallback player; **card sourcing and sample ordering starts in parallel** |
| Feb '27 | Card sourcing continues; artist portal build begins (upload, catalog, analytics) |
| Mar '27 | Artist portal continues; bulk card order placed once samples are approved |
| Apr '27 | Cards arrive — encode, QA, import into registry; closed beta with real artists; monetization integration |
| May '27 | QA hardening, security review, buffer for slippage |
| Jun '27 | **Launch** |

## Why card sourcing starts in January, not April

Custom NFC card manufacturing (design approval, sample rounds, bulk
production, shipping) routinely takes 6–10 weeks and doesn't compress
the way software work can. Starting it late is the single most likely
thing to push the June date — everything else on this timeline is
software and can flex around a part-time schedule; the hardware supply
chain can't.

## Protecting the June date on a part-time engagement

Keep launch scope to the table above and treat the Capacitor-wrapped
native app as a **post-launch** item — tap-to-play already works from
the browser on both Android and iOS without it (see
`05-nfc-authentication.md`), so it adds polish, not a launch blocker.

The same logic applies to anything marked "Post-launch" in
`06-pages-to-design.md` — detailed analytics, payout automation,
self-serve artist signup, full admin metrics. None of these are on the
critical path to a fan successfully tapping a card and hearing music;
they can start as manual processes and get real pages after June.

## Dependency this schedule assumes

Card sourcing (Jan–Apr) and software development run **in parallel**,
not sequentially. If card sourcing is delayed for any reason (sample
rejected, supplier lead time longer than quoted), that's the thing to
flag immediately — it's the one workstream on this timeline without
slack to absorb a slip quietly.
