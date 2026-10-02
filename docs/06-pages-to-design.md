# Pages to Design

Full page inventory for the web app, grouped by surface, flagged by
launch-vs-post-launch priority. See `08-conventions.md` for route-level
technical notes on the highest-stakes pages (the tap-landing route above
all).

## Public / marketing site
| Page | Priority |
|---|---|
| Landing page (value prop, how it works) | Launch |
| Artist directory / browse | Launch |
| Individual artist page (bio, sample, "get the card") | Launch |
| Store / checkout (cart, payment, shipping) | Launch |
| Order confirmation + tracking | Launch |
| FAQ / how tap-to-play works | Launch |
| About / contact / support | Launch |

## Fan / user app
| Page | Priority |
|---|---|
| Sign up / log in | Launch |
| Tap landing page — new/unclaimed card (claim flow) | Launch |
| Tap landing page — already-owned card (straight to player) | Launch |
| Player / now playing screen | Launch |
| First-tap onboarding / "how this works" tooltip | Launch |
| My library (all owned cards) | Launch |
| Account settings | Launch |
| Error state: card already claimed by someone else | Launch |
| Error state: expired/invalid tap link | Launch |
| Order history | Post-launch (can piggyback on store's order confirmation at first) |

## Artist portal
| Page | Priority |
|---|---|
| Artist login (invite-only at first — no self-serve signup needed yet) | Launch |
| Dashboard (cards claimed, plays, revenue snapshot) | Launch |
| Upload track / release | Launch |
| Catalog management (edit, organize releases) | Launch |
| Card configuration (Artist Card vs Music Card, quantity) | Launch |
| Detailed analytics | Post-launch |
| Payout / revenue settings | Post-launch (manual payouts are fine for a handful of launch artists) |
| Self-serve artist signup | Post-launch |

## Admin (internal, platform team only)
| Page | Priority |
|---|---|
| Card management (status, batch import of UID manifests) | Launch — not optional, it's how claimed/unclaimed cards get tracked |
| Artist approval / onboarding | Launch (lightweight — a handful of artists at launch) |
| User lookup / support tools | Launch (minimal — enough to unblock a support ticket) |
| Full metrics dashboard | Post-launch |
| Dispute/refund tooling | Post-launch |

## Rule of thumb for what's actually launch-critical

Anything a fan touches during the tap-to-play moment (claim page,
player, error states) is non-negotiable for June. Anything only the
team touches internally (full admin metrics, payout automation,
self-serve artist signup) can start as a manual process or a
spreadsheet and get a real page later — a reasonable trade for a
part-time timeline, not a corner cut on the product itself.
