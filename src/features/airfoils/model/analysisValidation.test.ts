import { describe, expect, it } from "vitest";
import { validateXfoilAnalysisSettings } from "./analysisValidation";

const valid = { reynolds: 300000, mach: 0.04, alphaStart: -6, alphaEnd: 18, alphaStep: 2, ncrit: 9, iterations: 100 };

describe("validateXfoilAnalysisSettings", () => {
  it("rejects invalid solver conditions with field-level messages", () => {
    const result = validateXfoilAnalysisSettings({ ...valid, reynolds: -1, mach: 1, alphaStart: 8, alphaEnd: -2, alphaStep: 0, ncrit: 20, iterations: Infinity });

    expect(result).toMatchObject({
      valid: false,
      errors: {
        reynolds: expect.any(String), mach: expect.any(String), alphaStart: expect.any(String), alphaStep: expect.any(String), ncrit: expect.any(String), iterations: expect.any(String),
      },
    });
  });

  it("accepts bounded finite conditions and reports sweep count", () => {
    expect(validateXfoilAnalysisSettings(valid)).toEqual({ valid: true, sweepPoints: 13 });
  });
});
