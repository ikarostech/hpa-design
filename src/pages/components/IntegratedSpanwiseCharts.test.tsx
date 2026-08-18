import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { StructuralAnalysisResult } from "../../features/structures/model/types";
import type { AnalysisResult } from "../../features/analysis/model/types";
import { buildIntegratedChartData, IntegratedSpanwiseCharts } from "./IntegratedSpanwiseCharts";

const structuralResult = {
  points: [{
    yPosition: 0.5,
    distributedLoad: 120,
    bendingMoment: 45,
    bendingMomentCapacity: 180,
    minReserveFactor: 3,
    torque: 8,
    torqueCapacity: 32,
  }],
} as StructuralAnalysisResult;

const aerodynamicResult = {
  rows: [{
    alpha: 4,
    cl: 0.8,
    spanwise: {
      axis: { key: "semi-span", unit: "m", label: "半翼幅" },
      reference: { side: "right", origin: "centerline", alphaDegrees: 4, speed: 20, density: 1.2, elasticAxisChordFraction: 0.35 },
      samples: [{ position: 0.5, values: {
        stationWidth: 0.5, chord: 1, circulation: 2, localLiftCoefficient: 0.7,
        liftPerLength: 110, inducedDragPerLength: 4, profileDragPerLength: 3,
        dragPerLength: 7, pitchingMomentPerLength: -2, torqueAboutElasticAxisPerLength: 5,
      } }],
    },
  }],
} as unknown as AnalysisResult;

afterEach(cleanup);

describe("IntegratedSpanwiseCharts", () => {
  it("plots the independent structural result without requiring a coupled result", () => {
    render(<IntegratedSpanwiseCharts structuralResult={structuralResult} aerodynamicResult={aerodynamicResult} alphaDegrees={4} />);

    expect(screen.getByRole("img", { name: "翼幅方向の荷重・曲げ分布" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "翼幅方向のねじり分布" })).toBeTruthy();
    for (const label of ["空力揚力分布", "空力抗力分布", "構造解析適用荷重", "曲げモーメント", "曲げ耐荷重", "安全率", "空力ねじり荷重", "ねじりモーメント", "ねじり耐荷重"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(buildIntegratedChartData(structuralResult, aerodynamicResult.rows[0].spanwise)[0]).toMatchObject({ aerodynamicLift: 110, aerodynamicDrag: 7, structuralLift: 120, bendingMoment: 45, bendingCapacity: 180, aerodynamicTorque: 5, torque: 8, torqueCapacity: 32 });
  });
});
