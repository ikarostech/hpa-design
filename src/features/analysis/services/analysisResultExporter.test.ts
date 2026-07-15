import { describe, expect, it } from "vitest";
import { analysisResultExporter, createDesignSummary } from "./analysisResultExporter";

const result = {
  id: "result-cruise",
  caseId: "case-cruise",
  clMax: 1.23456,
  cdMin: 0.023456,
  maxLD: 42.345,
  cm0: -0.03456,
  status: "completed" as const,
  rows: [
    { caseId: "case-cruise", alpha: 2, cl: 0.98765, cd: 0.023456, cm: -0.03456, ld: 42.345, status: "completed" as const },
  ],
};

describe("analysisResultExporter", () => {
  it("exports only selected results as UTF-8 BOM CSV with fixed columns and precision", async () => {
    const output = await analysisResultExporter.export({
      results: [result, { ...result, id: "result-other", caseId: "case-other", rows: [] }],
      selectedResultIds: [result.id],
      designName: "Long Range UAV",
    });

    expect(output.fileName).toBe("long-range-uav-analysis-results.csv");
    expect(output.mimeType).toBe("text/csv;charset=utf-8");
    expect(output.content).toBe("\uFEFFcase_id,result_id,status,alpha_deg,cl,cd,cm,ld\r\ncase-cruise,result-cruise,completed,2.0,0.9877,0.023456,-0.0346,42.35\r\n");
  });

  it("exports selected result JSON and a design summary with the same metrics", async () => {
    const output = await analysisResultExporter.exportJson({ results: [result], selectedResultIds: [result.id], designName: "Long Range UAV" });

    expect(output.fileName).toBe("long-range-uav-analysis-results.json");
    expect(JSON.parse(output.content)).toEqual([result]);
    expect(createDesignSummary({ name: "Long Range UAV", analysisCases: [{ id: "case-cruise", name: "Cruise", status: "completed" }], analysisResults: [result] })).toContain("Cruise: CLmax 1.235 / 最大 L/D 42.35");
  });
});
