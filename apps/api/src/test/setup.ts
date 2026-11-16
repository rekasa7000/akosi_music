// Loads apps/api/.env the same way src/env.ts does for the real
// server, so `pnpm test` works locally against the docker-compose
// Postgres without every test file repeating this.
try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional — CI injects these vars directly.
}
// .env sets NODE_ENV=development for real local dev runs — force it
// back to "test" here so app.ts's logger-silencing and any other
// test/development branches see the environment vitest is actually
// running under.
process.env.NODE_ENV = "test";
