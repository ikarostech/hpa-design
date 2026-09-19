import { describe, expect, it } from "vitest";
import type { StaticAeroelasticResult } from "./staticAeroelasticSolver";
import { createAeroelasticResultCsv, createAeroelasticResultSummary } from "./aeroelasticResultExporter";

const result = {
  id: "coupled-1",
  createdAt: "2026-08-15T00:00:00.000Z",
  status: "max-iterations",
  reviewStatus: "current",
  aircraftSnapshot: { id: "wing", span: 2, rootChord: 1, tipChord: 1, taperRatio: 1, twist: 0, dihedral: 0, sweep: 0, incidence: 0, wingArea: 2, aspectRatio: 2, mac: 1, staticMargin: 0, sections: [] },
  structuralDesignId: "spar",
  materialIds: ["carbon"],
  condition: { mode: "fixed-alpha", alphaDegrees: 4 },
  settings: { maxIterations: 2, relaxationFactor: 0.3, displacementTolerance: 1e-5, loadTolerance: 1e-5, liftTolerance: 1e-4 },
  density: 1.225,
  speed: 10,
  elasticAxisChordFraction: 0.4,
  alphaDegrees: 4,
  cl: 0.5,
  cdi: 0.02,
  cm: -0.01,
  totalLift: 61.25,
  spanLoads: [{ yPosition: 0.5, width: 1, circulation: 1, liftPerLength: 30.625, dragPerLength: 1.225, torquePerLength: 0.5 }],
  structuralResult: { id: "structure", designId: "spar", loadCaseId: "load", status: "completed", createdAt: "2026-08-15T00:00:00.000Z", designSnapshot: { id: "spar", name: "Spar", sections: [], loadCases: [] }, loadCaseSnapshot: { id: "load", name: "Coupled", source: "aerodynamic", loadFactor: 1, safetyFactor: 1, distributedLoads: [], pointLoads: [], status: "completed" }, materialIds: ["carbon"], points: [], summary: { mass: 1, maxDeflection: 0.1, maxTwist: 0.02, minReserveFactor: 1.5, governingLoadCase: "Coupled", governingPosition: 0, governingPlyId: "p1", governingMode: "繊維引張", reactionForce: -30, reactionMoment: -10, forceBalanceError: 0 } },
  undeformedMesh: { nodes: [], panels: [], strips: [] },
  deformedMesh: { nodes: [], panels: [], strips: [] },
  iterations: [{ iteration: 1, alphaDegrees: 4, cl: 0.5, cdi: 0.02, totalLift: 61.25, maxDeflection: 0.1, maxTwist: 0.02, displacementResidual: 1, loadResidual: null, liftResidual: 0 }],
  warnings: ["大変形のため要確認"],
} satisfies StaticAeroelasticResult;

describe("aeroelastic result export", () => {
  it("exports span loads and convergence history to CSV", () => {
    const csv = createAeroelasticResultCsv(result);

    expect(csv).toContain("[span_loads]");
    expect(csv).toContain("lift_N_per_m");
    expect(csv).toContain("[iterations]");
    expect(csv).toContain("displacement_residual");
    expect(csv).toContain("max_twist_deg");
    expect(csv).toContain("rotation_deg,twist_deg");
    expect(createAeroelasticResultSummary(result)).toContain("0.02 °");
  });

  it("reports non-convergence, applicability warnings, and method limits in Markdown", () => {
    const summary = createAeroelasticResultSummary(result);

    expect(summary).toContain("最大反復到達");
    expect(summary).toContain("大変形のため要確認");
    expect(summary).toContain("定常VLM");
    expect(summary).toContain("線形Euler–Bernoulli梁");
  });
});
