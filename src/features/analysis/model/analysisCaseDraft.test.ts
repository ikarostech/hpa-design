import { describe, expect, it } from "vitest";
import { createAnalysisCaseDraft, validateAnalysisCaseDraft } from "./analysisCaseDraft";

const analysisCase = {
  id: "case-cruise",
  name: "Cruise",
  method: "LLT" as const,
  alphaStart: -2,
  alphaEnd: 10,
  alphaStep: 2,
  speed: 20,
  altitude: 120,
  reynolds: 420000,
  geometryId: "aircraft-1",
  status: "not-run" as const,
};

describe("analysis case draft", () => {
  it("rejects an invalid sweep, flight conditions, and missing geometry", () => {
    const draft = {
      ...createAnalysisCaseDraft(analysisCase),
      alphaStart: 12,
      alphaEnd: 4,
      alphaStep: 0,
      speed: 0,
      altitude: -1,
      reynolds: 0,
      geometryId: "missing",
    };

    expect(validateAnalysisCaseDraft(draft, new Set(["aircraft-1"]))).toEqual({
      valid: false,
      errors: expect.objectContaining({
        alphaEnd: expect.any(String),
        alphaStep: expect.any(String),
        speed: expect.any(String),
        altitude: expect.any(String),
        reynolds: expect.any(String),
        geometryId: expect.any(String),
      }),
    });
  });
});
