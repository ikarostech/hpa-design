import { describe, expect, it } from "vitest";
import type { AirfoilPolar } from "../../airfoils/model/types";
import { AnalysisExecutionCancelledError, executeAnalysisCase } from "./analysisExecutionService";

const sectionDefaults = { xOffset: 0, chordwisePanels: 4, spanwisePanels: 4, chordwiseDistribution: "cosine" as const, spanwiseDistribution: "uniform" as const };
const aircraft = {
  id: "aircraft-1", span: 4, rootChord: 1, tipChord: 0.5, taperRatio: 0.5,
  twist: 0, dihedral: 0, sweep: -3.576, incidence: 0, wingArea: 3, aspectRatio: 16 / 3, mac: 0.78,
  staticMargin: 8,
  sections: [
    { ...sectionDefaults, id: "root", yPosition: 0, chord: 1, twist: 0, dihedral: 0, airfoilId: "af-1" },
    { ...sectionDefaults, id: "tip", yPosition: 2, chord: 0.5, twist: 0, dihedral: 0, airfoilId: "af-2" },
  ],
};

const analysisCase = {
  id: "case-1", name: "Cruise", method: "LLT" as const,
  alphaStart: -2, alphaEnd: 2, alphaStep: 2, speed: 20, altitude: 100, reynolds: 400000,
  geometryId: aircraft.id, status: "not-run" as const,
};

const createPolar = (id: string, airfoilId: string, liftOffset: number): AirfoilPolar => ({
  id,
  airfoilId,
  caseName: `${airfoilId}-400k`,
  reynolds: 400000,
  mach: 0,
  alphaStart: -6,
  alphaEnd: 6,
  alphaStep: 3,
  ncrit: 9,
  convergedPoints: 5,
  requestedPoints: 5,
  status: "complete",
  points: [-6, -3, 0, 3, 6].map((alpha) => ({ alpha, cl: alpha * 0.1 + liftOffset, cd: 0.01 + (alpha * 0.1 + liftOffset) ** 2 * 0.02, cm: -0.04 })),
});

const polars = [createPolar("polar-1", "af-1", 0), createPolar("polar-2", "af-2", 0.2)];

describe("executeAnalysisCase", () => {
  it("runs both supported methods with the section mesh and reports incremental progress", async () => {
    const progress: number[] = [];

    const result = await executeAnalysisCase({
      analysisCase,
      aircraft,
      polars,
      createId: () => "result-1",
      onProgress: ({ completed }) => progress.push(completed),
    });
    const vlmResult = await executeAnalysisCase({
      analysisCase: { ...analysisCase, method: "VLM" },
      aircraft,
      polars,
      createId: () => "result-2",
      onProgress: () => undefined,
    });

    expect(result).toMatchObject({
      id: "result-1",
      caseId: analysisCase.id,
      status: "completed",
      caseSnapshot: analysisCase,
      aircraftSnapshot: aircraft,
      airfoilIds: ["af-1", "af-2"],
      polarIds: ["polar-1", "polar-2"],
    });
    expect(result.rows).toHaveLength(3);
    expect(progress).toEqual([1, 2, 3]);
    expect(vlmResult.rows[2].cl).not.toBe(result.rows[2].cl);
  });

  it("reflects geometric twist and sweep in the calculated lift", async () => {
    const baseline = await executeAnalysisCase({ analysisCase, aircraft, polars, createId: () => "baseline", onProgress: () => undefined });
    const twisted = await executeAnalysisCase({
      analysisCase,
      aircraft: { ...aircraft, sections: [aircraft.sections[0], { ...aircraft.sections[1], twist: -6 }] },
      polars,
      createId: () => "twisted",
      onProgress: () => undefined,
    });
    const swept = await executeAnalysisCase({
      analysisCase,
      aircraft: { ...aircraft, sections: [aircraft.sections[0], { ...aircraft.sections[1], xOffset: 1.2 }] },
      polars,
      createId: () => "swept",
      onProgress: () => undefined,
    });
    const dihedral = await executeAnalysisCase({
      analysisCase,
      aircraft: { ...aircraft, sections: [{ ...aircraft.sections[0], dihedral: 30 }, aircraft.sections[1]] },
      polars,
      createId: () => "dihedral",
      onProgress: () => undefined,
    });

    expect(twisted.rows[1].cl).toBeLessThan(baseline.rows[1].cl);
    expect(Math.abs(swept.rows[2].cl)).toBeLessThan(Math.abs(baseline.rows[2].cl));
    expect(Math.abs(dihedral.rows[2].cl)).toBeLessThan(Math.abs(baseline.rows[2].cl));
  });

  it("stops without producing a result when the job is cancelled", async () => {
    const controller = new AbortController();

    await expect(executeAnalysisCase({
      analysisCase,
      aircraft,
      polars,
      signal: controller.signal,
      createId: () => "result-1",
      onProgress: () => controller.abort(),
    })).rejects.toBeInstanceOf(AnalysisExecutionCancelledError);
  });
});
