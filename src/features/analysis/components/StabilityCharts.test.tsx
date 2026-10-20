import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AnalysisResult } from "../model/types";
import { StabilityCharts } from "./StabilityCharts";

afterEach(cleanup);
const result: AnalysisResult = { id: "rigid", caseId: "case", status: "completed", clMax: 0.6, cdMin: 0.01, maxLD: 20, cm0: 0.04,
  rows: [0, 4].map((alpha) => ({ caseId: "case", alpha, cl: 0.2 + alpha * 0.1, cd: 0.01, cm: 0.04 - alpha * 0.02, ld: 20, status: "completed" })) };

describe("StabilityCharts", () => {
  it("shows uncomputed derivatives as unavailable rather than zero curves", () => {
    render(<StabilityCharts results={[result]} />);
    expect(screen.getAllByRole("figure")).toHaveLength(4);
    expect(within(screen.getByRole("figure", { name: "縦安定・トリム Cm - α" })).queryByText(/未算出/)).toBeNull();
    for (const name of ["上反角効果 Crβ - α", "横力微係数 CYβ - α", "方向静安定 Cnβ - α"]) {
      const chart = within(screen.getByRole("figure", { name }));
      expect(chart.getByText("未算出（再解析してください）")).toBeTruthy();
      expect(chart.queryByRole("application")).toBeNull();
    }
  });

  it("plots computed derivatives, including zero, instead of the unavailable state", () => {
    render(<StabilityCharts results={[{ ...result, rows: result.rows.map((row) => ({ ...row, crBeta: 0, cyBeta: -0.2, cnBeta: 0.1 })) }]} />);
    expect(screen.queryByText(/未算出/)).toBeNull();
    expect(screen.getAllByRole("application")).toHaveLength(4);
    expect(screen.queryByText("CL - α")).toBeNull();
    expect(screen.queryByText("L/D - α")).toBeNull();
  });
});
