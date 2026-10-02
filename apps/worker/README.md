# Worker

Not yet scaffolded.

Transcodes artist-uploaded audio into a consistent streaming format
(AAC/Opus), triggered by uploads landing in the raw storage bucket.
Stateless and idempotent — never writes to card or ownership records.

**Stack:** Lambda/Cloud Run Jobs + ffmpeg (see
[`../../docs/04-tech-stack.md`](../../docs/04-tech-stack.md) for the
AWS/GCP split).

**Read before building here:**
- [`../../docs/03-architecture.md`](../../docs/03-architecture.md)
- [`../../docs/08-conventions.md`](../../docs/08-conventions.md) — Worker section
