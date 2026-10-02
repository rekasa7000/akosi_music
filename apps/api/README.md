# API

The trust boundary of the platform: ownership verification (NFC tap
auth), catalog resolution, and signed playback URL minting. Nothing
else mints signed URLs.

Scaffolded with Fastify + TypeScript, using
[`@fastify/type-provider-typebox`](https://github.com/fastify/fastify-type-provider-typebox)
for request/response schema validation — required per
`08-conventions.md` ("Strict typing, schema validation on every
route"). `src/index.ts` has a minimal `/health` route showing the
type-provider wiring; real routes (`/tap`, `/cards/claim`, etc.) aren't
built yet.

**Stack:** Node.js, Fastify, TypeScript, TypeBox.

**Scripts:**
```bash
pnpm dev        # tsx watch src/index.ts
pnpm build      # tsc -> dist/
pnpm start      # node dist/index.js
pnpm typecheck
```

**Read before building here:**
- [`../../docs/05-nfc-authentication.md`](../../docs/05-nfc-authentication.md) — don't reimplement this flow from memory
- [`../../docs/08-conventions.md`](../../docs/08-conventions.md) — API section
- [`../../docs/09-data-model.md`](../../docs/09-data-model.md)
