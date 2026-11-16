import { describe, expect, it } from "vitest";
import { formatMb } from "./upload-limits";

describe("formatMb", () => {
  it("converts bytes to a one-decimal MB string", () => {
    expect(formatMb(10 * 1024 * 1024)).toBe("10.0");
    expect(formatMb(1024 * 1024)).toBe("1.0");
  });

  it("rounds to one decimal place rather than truncating", () => {
    expect(formatMb(1.55 * 1024 * 1024)).toBe("1.6");
  });

  it("handles zero", () => {
    expect(formatMb(0)).toBe("0.0");
  });
});
