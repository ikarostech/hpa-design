import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AnalysisResult } from "../model/types";
import { StabilityComparison } from "./StabilityComparison";

afterEach(cleanup);
describe("StabilityComparison", () => {
  it("compares shapes with their reference conditions and labels missing derivatives", () => {
    const result: AnalysisResult = { id: "r", caseId: "case", clMax: 0.6, cdMin: 0.01, maxLD: 30, cm0: 0.04, status: "completed",
      caseSnapshot: { id: "case", name: "Rigid", method: "VLM", scope: "aircraft", cgX: 0.4, cgZ: -0.2, beta: 0,
        alphaStart: 0, alphaEnd: 4, alphaStep: 4, speed: 10, altitude: 0, reynolds: 100000, geometryId: "wing", status: "completed" },
      rows: [0, 4].map((alpha) => ({ caseId: "case", alpha, cl: 0.2 + alpha * 0.1, cm: 0.04 - alpha * 0.02,
        cd: 0.01, ld: 20, status: "completed", crBeta: -0.1, cyBeta: 0.2, cnBeta: 0.08 })) };
    const manual: AnalysisResult = { ...result, id: "m", caseSnapshot: { ...result.caseSnapshot!, name: "Manual", stabilityShape: { kind: "manual", elasticAxisChordFraction: 0.35,
      points: [{ yPosition: 0, deflection: 0, twist: 0 }, { yPosition: 2, deflection: 0.2, twist: 0 }] } }, rows: result.rows.map((r) => ({ ...r, crBeta: undefined })) };
    render(<StabilityComparison results={[result, manual]} />);
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText("剛体（比較基準）")).toBeTruthy();
    expect(within(rows[1]).getByText("-0.100")).toBeTruthy();
    expect(within(rows[2]).getByText("簡易評価（仮のたわみ）")).toBeTruthy();
    expect(within(rows[2]).getByText("未算出")).toBeTruthy();
    expect(screen.getByText(/同じ速度・迎角・横滑り角・重心/)).toBeTruthy();
  });
});
