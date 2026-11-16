import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// @testing-library/react's auto-cleanup only self-registers when it
// finds a global `afterEach` — Vitest doesn't install one unless
// test.globals is enabled, so without this every test after the
// first would render into a DOM still holding the previous test's
// markup.
afterEach(() => {
  cleanup();
});
