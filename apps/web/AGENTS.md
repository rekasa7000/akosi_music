<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## UI components: always use shadcn/ui

This app was scaffolded with `shadcn@latest init`. Always use shadcn/ui
for UI components — don't hand-roll a component (button, dialog, form
field, etc.) or pull in a different component library when a shadcn
equivalent exists.

Add new components with:

```bash
pnpm dlx shadcn@latest add <component>
```

This writes into `components/ui/`, which is local, owned code (not a
node_modules dependency) — customize freely once added, but don't
duplicate a component that already has a shadcn equivalent just to
avoid editing the generated file.
