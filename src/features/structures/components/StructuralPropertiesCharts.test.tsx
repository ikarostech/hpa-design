import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { StructuralAnalysisResult } from "../model/types";
import { buildStructuralPropertiesChartData, StructuralPropertiesCharts } from "./StructuralPropertiesCharts";

const result = {
  points: [{
    yPosition: 0.5,
    bendingMomentCapacity: 180,
    torqueCapacity: 32,
    ei: 42_000,
    gj: 13_000,
    outerDiameter: 0.08,
    thickness: 0.0015,
    linearMass: 0.45,
  }],
} as StructuralAnalysisResult;

afterEach(cleanup);

describe("StructuralPropertiesCharts", () => {
  it("shows pipe strength and stiffness distributions separately from load response", () => {
    render(<StructuralPropertiesCharts result={result} />);

    expect(screen.getByRole("img", { name: "翼幅方向の曲げ強度・剛性分布" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "翼幅方向のねじり強度・剛性分布" })).toBeTruthy();
    for (const label of ["曲げ耐荷重", "曲げ剛性 EI", "ねじり耐荷重", "ねじり剛性 GJ"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(buildStructuralPropertiesChartData(result)).toEqual([{
      y: 0.5,
      bendingCapacity: 180,
      bendingStiffness: 42_000,
      torqueCapacity: 32,
      torsionalStiffness: 13_000,
    }]);
  });
});
