---
name: impeccable
description: "Use when the user wants a page, feature, or UI enhancement built for this app (akosi) and wants the brief engineered to be hallucination-resistant before any code gets written. Turns a rough ask (\"build the artist directory page\") into a fully-specified prompt grounded in akosi's real brand, product truth, and open questions — modeled on a reference anatomy, not generic copywriting advice."
---

# /impeccable

Turn a rough feature/page ask into a fully-specified, hallucination-resistant
prompt for enhancing **akosi**, grounded in this repo's actual brand, product
state, and open questions — then (after confirming) execute it.

## Usage

```
/impeccable <rough ask>
```

Example: `/impeccable build the artist directory page`

## Why this exists

A vague ask like "build the artist directory page" invites an LLM to fabricate
the missing specifics: a plausible-sounding audience, a generic brand voice,
fake testimonials, invented pricing, a CTA that doesn't match what the product
actually does yet. The fix isn't "write better copy" — it's write a brief that
doesn't leave room for invention in the first place.

The anatomy below is reverse-engineered from a reference prompt (for a
fictional distributed-tracing tool, "Tortuga") that got every one of these
dimensions right in one paragraph:

1. **What it is + the one differentiator** — a sentence, not a feature list.
2. **Audience + the frame they're evaluating in** — who's looking at this,
   and what they're comparing it against or trying to decide.
3. **Brand constraint** — tone and visual language, cited from the actual
   design system, not invented fresh per page.
4. **The one primary action** — a single CTA the page is built around, not a
   menu of equally-weighted options.
5. **Hard "do not claim" list** — facts that are commercially/product
   undecided and must not be stated as settled, named explicitly so the
   model can't default to a plausible guess.
6. **Real assets available** — actual data/components/copy that exist and
   should be shown instead of a stand-in.
7. **Explicit absence callout** — what's *not* available (logos,
   testimonials, metrics) stated outright, so the model doesn't fabricate
   social proof to fill the gap.

## Reference example

The actual prompt this skill is modeled on, verbatim — read it before
composing a new one, so the output matches its density and ordering rather
than drifting toward a generic spec document:

> Make me a landing page for Tortuga, our distributed-tracing tool for SREs
> running microservices. It reconstructs the smallest causal trace that
> explains a latency regression, so engineers inspect an incident path
> instead of searching a telemetry lake. Audience is senior backend
> engineers between incidents, evaluating us against Datadog/Honeycomb.
> Brand is technical and blunt, no hype. The main action installs a Helm
> chart into the engineer's cluster and points it at their existing
> OpenTelemetry collector. Do not claim that Tortuga is open source,
> self-hosted, SaaS, or any particular price; those commercial details are
> not decided. We can show a real trace, query, config, and reproducible
> latency methodology, but we have no customer logos or testimonials.

Mapped to the anatomy: (1) "distributed-tracing tool... reconstructs the
smallest causal trace... instead of searching a telemetry lake" (2) "senior
backend engineers between incidents, evaluating us against
Datadog/Honeycomb" (3) "technical and blunt, no hype" (4) "installs a Helm
chart... points it at their existing OpenTelemetry collector" (5) "Do not
claim... open source, self-hosted, SaaS, or any particular price" (6) "a
real trace, query, config, and reproducible latency methodology" (7) "no
customer logos or testimonials."

An akosi brief should read at this same density — one paragraph, every
clause doing one of the seven jobs above, nothing padded out into prose.

## Steps

1. **Pin down the ask.** If `<rough ask>` doesn't clearly name one page or
   feature, ask the user to narrow it to one surface before proceeding — a
   brief that tries to cover two pages at once dilutes every constraint
   below.

2. **Pull brand constraint from source, don't paraphrase from memory.**
   Read `DESIGN.md` at the repo root. Quote the specific tokens/voice rules
   that apply to this ask (e.g. "ember/plum palette, `font-display` headlines,
   capsule buttons, plain-spoken no-fluff copy, lowercase wordmark") rather
   than a generic "warm and modern" gloss.

3. **Pull audience + evaluation frame from product docs**, not assumption.
   Read `docs/02-product.md` and `docs/06-pages-to-design.md` to determine
   which actor this page is for (fan / artist-or-label / admin) and what
   they're actually trying to decide on this page (e.g. the landing page
   says "Artists & labels only, for now" — the audience for admin-adjacent
   pages is artists/labels deciding whether to onboard, not consumers).

4. **Pull the single primary action** from how the equivalent flow already
   works elsewhere in the app (e.g. home page's one CTA is "Manage a
   catalog" → `/admin/login`; the tap flow's one action is tap-to-unlock).
   Don't let the brief default to multiple competing CTAs.

5. **Build the hard "do not claim" list from `docs/01-claude.md`'s Current
   Project Status and `docs/02-product.md`'s Open Questions** — check
   specifically for:
   - Project stage: pre-build/proposal stage, nothing is live in production
     yet — never let a brief imply the product has shipped, has users, or
     has metrics.
   - Card claim/resale/transfer policy: explicitly undecided — don't let a
     brief state a claim or resale policy as fact.
   - Pricing: not set anywhere in the docs — don't invent a number or tier.
   - Artist roster: per the home page's own copy, "we're a small team,
     building release by release" with no shelf-sold cards yet — don't
     imply an existing catalog of signed artists beyond what's actually
     seeded in the database.
   Re-check this list against whatever the specific ask touches — a
   checkout-page ask needs a pricing caveat, an artist-dashboard ask needs
   an analytics-maturity caveat, etc.

6. **Identify real assets to show, and what's missing.** Grep/read the
   actual components and routes this page would reuse or sit beside
   (`AkosiWordmark`, `FoilCard`, `ThemeToggle`, `StageLight`, `Marquee`,
   existing Prisma models in `packages/database` if the page needs real
   data) so the brief points at what genuinely exists. Then state plainly
   what's *not* available for this ask (no customer logos, no
   testimonials, no finalized pricing/metrics) so nothing gets fabricated
   to fill a visual gap.

7. **Compose the final prompt** in the Tortuga anatomy's order (description
   → audience → brand → primary action → do-not-claim → available assets →
   explicit absences), as a single tight paragraph or a short tagged list —
   match the reference example's density, not a long spec document.

8. **Show the composed prompt to the user and ask whether to execute it now**
   against the codebase, or whether they want to edit it first. Don't
   silently proceed from brief straight into code changes without that
   checkpoint — the whole point of the brief is to be inspected before it
   drives work.
