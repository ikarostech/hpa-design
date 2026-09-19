import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "../../analysis/model/types";
import type { AircraftGeometry } from "../../aircraft/model/types";
import { createEllipticalLoadCase, createLoadCaseFromAerodynamicResult, createStructuralResultCsv, createStructuralSummary } from "./structuralLoadService";

const aircraft = { id: "aircraft-1", span: 4, wingArea: 3 } as AircraftGeometry;
const result = { id: "aero-result-1", caseId: "case-1", clMax: 1, caseSnapshot: { speed: 10 }, rows: [] } as unknown as AnalysisResult;

describe("structural load integration", () => {
  it("creates an elliptical baseline load from the assumed aircraft weight", () => {
    const loadCase = createEllipticalLoadCase({ aircraft, grossMass: 100, pointCount: 101 });
    let integratedHalfWingLift = 0;
    for (let index = 1; index < loadCase.distributedLoads.length; index += 1) {
      const left = loadCase.distributedLoads[index - 1];
      const right = loadCase.distributedLoads[index];
      integratedHalfWingLift += (left.liftPerLength + right.liftPerLength) * (right.yPosition - left.yPosition) / 2;
    }

    expect(loadCase.source).toBe("elliptical");
    expect(loadCase.name).toContain("想定重量 100 kg");
    expect(integratedHalfWingLift).toBeCloseTo(100 * 9.80665 / 2, 2);
    expect(loadCase.distributedLoads.at(-1)?.liftPerLength).toBeCloseTo(0, 8);
  });

  it("creates a half-wing elliptical distribution with the requested total lift", () => {
    const loadCase = createLoadCaseFromAerodynamicResult({ result, aircraft, density: 1.225, pointCount: 101, safetyFactor: 1.5 });
    const targetHalfLift = 0.5 * 1.225 * 10 ** 2 * aircraft.wingArea * result.clMax / 2;
    let integrated = 0;
    for (let index = 1; index < loadCase.distributedLoads.length; index += 1) {
      const left = loadCase.distributedLoads[index - 1];
      const right = loadCase.distributedLoads[index];
      integrated += (left.liftPerLength + right.liftPerLength) * (right.yPosition - left.yPosition) / 2;
    }

    expect(loadCase.source).toBe("aerodynamic");
    expect(loadCase.aerodynamicResultId).toBe(result.id);
    expect(integrated).toBeCloseTo(targetHalfLift, 2);
    expect(loadCase.distributedLoads.at(-1)?.liftPerLength).toBeCloseTo(0, 8);
  });

  it("uses the selected aerodynamic operating point distribution without rebuilding an ellipse", () => {
    const spanwiseResult = {
      ...result,
      rows: [{
        ...result.rows[0],
        alpha: 4,
        spanwise: {
          axis: { key: "semi-span", unit: "m", label: "半翼幅" },
          reference: { side: "right", origin: "centerline", alphaDegrees: 4, speed: 20, density: 1.2, elasticAxisChordFraction: 0.35 },
          samples: [
            { position: 0.25, values: { stationWidth: 0.5, liftPerLength: 140, torqueAboutElasticAxisPerLength: 8 } },
            { position: 0.75, values: { stationWidth: 0.5, liftPerLength: 60, torqueAboutElasticAxisPerLength: 2 } },
          ],
        },
      }],
    } as unknown as AnalysisResult;

    const loadCase = createLoadCaseFromAerodynamicResult({ result: spanwiseResult, aircraft, alphaDegrees: 4 });

    expect(loadCase.aerodynamicAlphaDegrees).toBe(4);
    expect(loadCase.distributedLoads).toEqual([
      { yPosition: 0.25, liftPerLength: 140, torquePerLength: 8 },
      { yPosition: 0.75, liftPerLength: 60, torquePerLength: 2 },
    ]);
  });

  it("exports auditable CSV and Markdown result summaries", () => {
    const structuralResult = {
      id: "struct-result-1", designId: "design-1", loadCaseId: "load-1", status: "completed" as const, createdAt: "2026-07-31T00:00:00.000Z",
      designSnapshot: { id: "design-1", name: "Main spar", sections: [], loadCases: [] },
      loadCaseSnapshot: { id: "load-1", name: "Cruise", source: "manual" as const, loadFactor: 1, safetyFactor: 1.5, distributedLoads: [], pointLoads: [], status: "completed" as const },
      materialIds: ["mat-1"],
      points: [{ yPosition: 0, distributedLoad: 100, shearForce: 200, bendingMoment: 150, bendingMomentCapacity: 450, bendingReserveFactor: 3, localBucklingReserveFactor: 2.8, brazierReserveFactor: 3.2, torque: 5, torqueCapacity: 20, torsionReserveFactor: 4, deflection: 0, rotation: 0, twist: 0, outerDiameter: 0.08, thickness: 0.001, ei: 1000, gj: 500, linearMass: 0.2, axialStress: 10e6, shearStress: 2e6, minReserveFactor: 2.5, criticalPlyId: "ply-1", criticalMode: "繊維引張" }],
      summary: { mass: 0.5, maxDeflection: 0.02, maxTwist: 0.01, minReserveFactor: 2.5, governingLoadCase: "Cruise", governingPosition: 0, governingPlyId: "ply-1", governingMode: "繊維引張", reactionForce: -200, reactionMoment: -150, forceBalanceError: 0, analysisWarnings: ["局部座屈は弾性スクリーニングです。"] },
    };

    expect(createStructuralResultCsv(structuralResult)).toContain("y_m,load_N_per_m,shear_N,bending_Nm");
    expect(createStructuralResultCsv(structuralResult)).toContain("bending_capacity_Nm,bending_reserve_factor,torque_Nm,torque_capacity_Nm,torsion_reserve_factor");
    expect(createStructuralResultCsv(structuralResult)).toContain("local_buckling_reserve_factor,brazier_reserve_factor");
    expect(createStructuralResultCsv(structuralResult)).toContain("rotation_deg,twist_deg");
    expect(createStructuralSummary(structuralResult)).toContain("0.010000 °");
    expect(createStructuralResultCsv(structuralResult)).toContain("2.5,ply-1");
    expect(createStructuralSummary(structuralResult)).toContain("最小リザーブファクター: 2.500");
    expect(createStructuralSummary(structuralResult)).toContain("Timoshenko梁");
    expect(createStructuralSummary(structuralResult)).toContain("Hashin初期層破壊");
    expect(createStructuralSummary(structuralResult)).toContain("局部座屈は弾性スクリーニングです。");
  });
});
