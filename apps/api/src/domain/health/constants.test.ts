import { describe, expect, it } from "vitest";
import { CATEGORY_WEIGHTS } from "./constants.js";

describe("CATEGORY_WEIGHTS", () => {
  it("matches Issue #3 required category weights exactly", () => {
    expect(CATEGORY_WEIGHTS).toEqual({
      "repository-health": 0.25,
      security: 0.25,
      governance: 0.2,
      cicd: 0.15,
      "quality-maintenance": 0.15
    });
  });

  it("sums to 1.0", () => {
    const total = Object.values(CATEGORY_WEIGHTS).reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});
