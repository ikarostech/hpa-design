import { describe, expect, it } from "vitest";
import { AnalysisExecutionCancelledError, executeAnalysisCase } from "./analysisExecutionService";

const aircraft = {
  id: "aircraft-1", span: 4, rootChord: 1, tipChord: 0.5, taperRatio: 0.5,
  twist: 0, dihedral: 0, sweep: 0, incidence: 0, wingArea: 3, aspectRatio: 16 / 3, mac: 0.78,
  staticMargin: 8, sections: [],
};

const analysisCase = {
  id: "case-1", name: "Cruise", method: "LLT" as const,
  alphaStart: -2, alphaEnd: 2, alphaStep: 2, speed: 20, altitude: 100, reynolds: 400000,
  geometryId: aircraft.id, status: "not-run" as const,
};

describe("executeAnalysisCase", () => {
  it("runs both supported methods and reports incremental progress", async () => {
    const progress: number[] = [];

    const result = await executeAnalysisCase({
      analysisCase,
      aircraft,
      polarIds: ["polar-1"],
      createId: () => "result-1",
      onProgress: ({ completed }) => progress.push(completed),
    });
    const vlmResult = await executeAnalysisCase({
      analysisCase: { ...analysisCase, method: "VLM" },
      aircraft,
      createId: () => "result-2",
      onProgress: () => undefined,
    });

    expect(result).toMatchObject({
      id: "result-1",
      caseId: analysisCase.id,
      status: "completed",
      caseSnapshot: analysisCase,
      aircraftSnapshot: aircraft,
      polarIds: ["polar-1"],
    });
    expect(result.rows).toHaveLength(3);
    expect(progress).toEqual([1, 2, 3]);
    expect(vlmResult.rows[2].cl).not.toBe(result.rows[2].cl);
  });

  it("stops without producing a result when the job is cancelled", async () => {
    const controller = new AbortController();

    await expect(executeAnalysisCase({
      analysisCase,
      aircraft,
      signal: controller.signal,
      createId: () => "result-1",
      onProgress: () => controller.abort(),
    })).rejects.toBeInstanceOf(AnalysisExecutionCancelledError);
  });
});
