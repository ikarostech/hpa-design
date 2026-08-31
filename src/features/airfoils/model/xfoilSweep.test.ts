import { describe, expect, it } from "vitest";
import { createXfoilAlphaSequences } from "./xfoilSweep";

describe("createXfoilAlphaSequences", () => {
  it("starts near zero and sweeps outward so one difficult endpoint cannot block the full polar", () => {
    expect(createXfoilAlphaSequences(-6, 18, 2)).toEqual([
      [0, 2, 4, 6, 8, 10, 12, 14, 16, 18],
      [-2, -4, -6],
    ]);
  });
});
