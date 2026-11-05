# Design

Branding extracted from `apps/web` (landing page, feedback/report forms, shared
components). Source of truth lives in [apps/web/app/globals.css](apps/web/app/globals.css),
[apps/web/app/layout.tsx](apps/web/app/layout.tsx), and the `akosi-*` components under
[apps/web/components/](apps/web/components/).

## Name & voice

- Wordmark: **akosi music**, always lowercase, with a `♪` between the two words
  in the accent color ([wordmark.tsx](apps/web/components/admin/wordmark.tsx)).
- Tone: short, plain-spoken sentences. No marketing fluff — "No app, no
  account, nothing to set up." Second person, present tense.
- Recurring phrase: **"Tap to unlock"** (marquee ticker on the landing page).

## Color

Role-based custom properties so the same names flip meaning between light and
dark mode, rather than a fixed dark-only palette. Accent hues stay fixed
across modes; only background/surface/text roles swap.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--akosi-bg` | `#f6ece6` | `#170b0d` | Page background |
| `--akosi-surface` | `#fffaf7` | `#3d1220` | Raised/alternate section background |
| `--akosi-fg` | `#241013` | `#f6ece6` | Primary text |
| `--akosi-muted-fg` | `#8a7570` | `#a8918c` | Secondary text |
| `--akosi-accent` | `#a83333` | `#b33b3b` | Primary action (buttons) |
| `--akosi-accent-2` | `#c85f2e` | `#e8774a` | Highlight / hover / emphasis text |

Palette family: warm, ember/plum reds and oranges on a cream (light) or
near-black burgundy (dark) base — a "stage light" mood, not a neutral SaaS
gray scale. Fixed, saturated hex values are used for the physical-card art
([foil-card.tsx](apps/web/components/landing/foil-card.tsx)) regardless of
theme, since a printed card's ink doesn't change with the room lighting:

- `ember` sweep: `#7a1f1a → #c23b2e → #ff8a3d → #ffd8a8`
- `plum` sweep: `#3d0f1f → #5c1a2e → #c23b2e → #ff8a3d`
- `flare` sweep: `#c23b2e → #ff8a3d → #ffd8a8 → #fff4e4`

## Typography

- **Sans (`--font-sans`)**: Inter — body copy, UI text.
- **Display (`--font-display`)**: Space Grotesk — headings, the wordmark,
  numerals, anything that needs presence. Set `font-display`, tight tracking,
  often `lowercase`.
- **Mono (`--font-mono`)**: Geist Mono — reserved, not used on marketing pages.
- Headline style: large, tight `leading-[0.95]`, `font-semibold`, with the
  second line of a two-line headline set in `--akosi-accent-2`.

## Shape & texture

- Pill buttons: `rounded-4xl` (very round, capsule-shaped).
- Cards/panels: large radii (`rounded-xl` and up), thick 2px borders using
  `border-akosi-fg/15` rather than a neutral gray border token.
- Dashed borders mark "handmade"/collectible moments (step cards, the
  "HAND ISSUED" badge, footer divider) — a deliberate counterpoint to the
  otherwise solid, confident shapes.
- Slight rotation on card art and step panels (`rotate(-2deg)` etc.) for a
  tactile, scattered/collaged feel rather than a rigid grid — collectible
  physical cards, not uniform UI tiles.
- One ambient animated moment per page, not scattered motion: the admin
  login's slow-drifting radial-gradient "stage light," and the landing
  page's looping marquee strip. Both respect `prefers-reduced-motion`.
- Oversized, near-invisible numerals (`text-[7rem]`, `text-akosi-fg/5`) used
  as background decoration behind step/feature cards.

## Components

- Buttons: capsule-shaped, primary action uses `bg-akosi-accent` with
  `hover:bg-akosi-accent-2`; outline/ghost variants fall back to neutral
  shadcn tokens for secondary chrome (nav, theme toggle).
- Forms (shadcn-based) stay neutral/minimal — the brand palette is reserved
  for primary actions, links, and the star rating, not every input.
- The `FoilCard` component is the one recurring illustrative motif: a
  gradient "sweep," an embossed chip, an NFC glyph, and the wordmark
  stamped in the corner — standing in for the physical product itself
  instead of generic stock art or abstract gradients.

## Theming

Light/dark is driven entirely by swapping the `--akosi-*` custom properties
under `.dark` ([globals.css](apps/web/app/globals.css)) — components reference
the role names (`bg-akosi-bg`, `text-akosi-fg`, etc.), never raw hex values,
so theme switching requires no per-component logic.
