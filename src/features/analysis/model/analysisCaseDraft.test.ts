import { describe, expect, it } from "vitest";
import { createAnalysisCaseDraft, updateAnalysisCase, validateAnalysisCaseDraft } from "./analysisCaseDraft";

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
  it("rejects invalid deformation and protects saved shape points during editing", () => {
    const manual = { ...analysisCase, method: "VLM" as const, scope: "aircraft" as const,
      stabilityShape: { kind: "manual" as const, elasticAxisChordFraction: 0.35,
        points: [{ yPosition: 0, deflection: 0, twist: 0 }, { yPosition: 2, deflection: 0.2, twist: -1 }] } };
    const draft = createAnalysisCaseDraft(manual);
    if (draft.stabilityShape?.kind !== "manual") throw new Error("manual shape expected");
    draft.stabilityShape.points[1].deflection = 0.4;
    expect(manual.stabilityShape.points[1].deflection).toBe(0.2);
    expect(updateAnalysisCase({ ...manual, status: "completed" }, draft).status).toBe("needs-review");
    draft.stabilityShape.points[1].yPosition = 0;
    expect(validateAnalysisCaseDraft(draft, new Set(["aircraft-1"]))).toMatchObject({ valid: false, errors: { stabilityShape: expect.any(String) } });
    expect(validateAnalysisCaseDraft({ ...manual, scope: "wing" }, new Set(["aircraft-1"]))).toMatchObject({ valid: false, errors: { stabilityShape: expect.any(String) } });
  });
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

  it("allows whole-aircraft VLM with sideslip but rejects whole-aircraft LLT", () => {
    const draft = { ...createAnalysisCaseDraft(analysisCase), method: "VLM" as const, scope: "aircraft" as const, beta: 3, cgX: 0.4 };
    expect(validateAnalysisCaseDraft(draft, new Set(["aircraft-1"]))).toMatchObject({ valid: true });
    expect(validateAnalysisCaseDraft({ ...draft, method: "LLT" }, new Set(["aircraft-1"]))).toMatchObject({ valid: false, errors: { method: expect.any(String) } });
    expect(validateAnalysisCaseDraft({ ...draft, beta: Number.NaN }, new Set(["aircraft-1"]))).toMatchObject({ valid: false, errors: { beta: expect.any(String) } });
    expect(validateAnalysisCaseDraft({ ...draft, cgX: Number.NaN }, new Set(["aircraft-1"]))).toMatchObject({ valid: false, errors: { cgX: expect.any(String) } });
    expect(validateAnalysisCaseDraft({ ...draft, cgZ: Number.NaN }, new Set(["aircraft-1"]))).toMatchObject({ valid: false, errors: { cgZ: expect.any(String) } });
  });
});
