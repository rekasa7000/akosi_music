import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Defensive: dist/ shouldn't contain *.test.js at all now that
    // tsconfig.build.json excludes test files, but this keeps a stale
    // or pre-existing dist/ from ever being picked up and double-
    // running everything against the same database.
    exclude: ["**/node_modules/**", "dist/**"],
    // Integration tests (admin-auth, public-cards) share rows in the
    // same Postgres database — running files in parallel workers risks
    // one test's cleanup racing another's setup.
    fileParallelism: false,
    setupFiles: ["./src/test/setup.ts"],
  },
});
