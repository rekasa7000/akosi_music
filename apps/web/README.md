# Web App

Fan-facing app (browse, claim, play, library) and the artist portal
(upload, catalog, analytics) — same Next.js codebase, gated routes.

Scaffolded with `shadcn@latest init` (Next.js + shadcn/ui, Radix base).

**Stack:** Next.js, TypeScript, Tailwind, shadcn/ui.

**UI components:** always use shadcn/ui — see
[`../../docs/08-conventions.md`](../../docs/08-conventions.md) and
[`AGENTS.md`](AGENTS.md) for the rule. Add new components with:

```bash
pnpm dlx shadcn@latest add <component>
```

This places components in `components/ui/`. Import as:

```tsx
import { Button } from "@/components/ui/button";
```

**Read before building here:**
- [`../../docs/03-architecture.md`](../../docs/03-architecture.md)
- [`../../docs/06-pages-to-design.md`](../../docs/06-pages-to-design.md)
- [`../../docs/08-conventions.md`](../../docs/08-conventions.md) — Web app section
- [`../../docs/05-nfc-authentication.md`](../../docs/05-nfc-authentication.md) — the tap-landing route is the entire product
