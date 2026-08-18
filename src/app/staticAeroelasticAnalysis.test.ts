import { describe, expect, it } from "vitest";
import type { AircraftGeometry } from "../features/aircraft/model/types";
import type { CarbonMaterial, StructuralDesign } from "../features/structures/model/types";
import { executeStaticAeroelasticAnalysis } from "../features/aeroelastic/services/staticAeroelasticSolver";
import type { AirfoilPolar } from "../features/airfoils/model/types";

const aircraft: AircraftGeometry = {
  id: "wing",
  span: 2,
  rootChord: 0.8,
  tipChord: 0.6,
  taperRatio: 0.75,
  twist: 0,
  dihedral: 0,
  sweep: 0,
  incidence: 0,
  wingArea: 1.4,
  aspectRatio: 2.857,
  mac: 0.705,
  staticMargin: 0,
  sections: [
    { id: "root", yPosition: 0, chord: 0.8, xOffset: 0, twist: 0, dihedral: 0, airfoilId: "af", chordwisePanels: 2, spanwisePanels: 4, chordwiseDistribution: "uniform", spanwiseDistribution: "uniform" },
    { id: "tip", yPosition: 1, chord: 0.6, xOffset: 0, twist: 0, dihedral: 0, airfoilId: "af", chordwisePanels: 2, spanwisePanels: 4, chordwiseDistribution: "uniform", spanwiseDistribution: "uniform" },
  ],
};

const material: CarbonMaterial = {
  id: "carbon",
  name: "UD carbon",
  e1: 140e9,
  e2: 9e9,
  g12: 5e9,
  nu12: 0.3,
  tensileStrength1: 1500e6,
  compressiveStrength1: 800e6,
  tensileStrength2: 50e6,
  compressiveStrength2: 150e6,
  shearStrength12: 80e6,
  density: 1550,
  plyThickness: 0.0002,
  reductionFactor: 0.8,
};

const design: StructuralDesign = {
  id: "spar",
  name: "Main spar",
  sections: [{
    id: "tube",
    length: 1,
    outerDiameter: 0.1,
    plies: [
      { id: "axial", materialId: material.id, angle: 0, count: 16 },
      { id: "torsion", materialId: material.id, angle: 45, count: 4 },
      { id: "torsion-negative", materialId: material.id, angle: -45, count: 4 },
    ],
  }],
  loadCases: [],
};
const polar: AirfoilPolar = { id: "polar", airfoilId: "af", caseName: "test", reynolds: 300000, mach: 0, alphaStart: -10, alphaEnd: 20, alphaStep: 30, ncrit: 9, convergedPoints: 2, requestedPoints: 2, status: "complete", points: [{ alpha: -10, cl: -1, cd: 0.02, cm: -0.1 }, { alpha: 20, cl: 2, cd: 0.03, cm: -0.1 }] };

describe("static aeroelastic analysis integration", () => {
  it("converges fixed-angle VLM and beam deformation into one result", () => {
    const result = executeStaticAeroelasticAnalysis({
      resultId: "coupled-fixed",
      aircraft,
      structuralDesign: design,
      materials: [material],
      density: 1.225,
      speed: 10,
      elasticAxisChordFraction: 0.4,
      condition: { mode: "fixed-alpha", alphaDegrees: 4 },
    });

    expect(result.status).toBe("converged");
    expect(result.iterations.length).toBeGreaterThan(1);
    expect(result.structuralResult.summary.maxDeflection).toBeGreaterThan(0);
    expect(result.spanLoads.reduce((sum, load) => sum + load.liftPerLength * load.width, 0)).toBeGreaterThan(0);
    expect(result.deformedMesh.nodes.some((node, index) => node.z !== result.undeformedMesh.nodes[index].z)).toBe(true);
    expect(result.iterations.at(-1)!.displacementResidual).toBeLessThanOrEqual(result.settings.displacementTolerance);
  });

  it("trims angle of attack to the requested total lift", () => {
    const targetLift = 20;
    const result = executeStaticAeroelasticAnalysis({
      resultId: "coupled-trimmed",
      aircraft,
      structuralDesign: design,
      materials: [material],
      density: 1.225,
      speed: 10,
      elasticAxisChordFraction: 0.4,
      condition: { mode: "target-lift", targetLift, minimumAlpha: -5, maximumAlpha: 15 },
    });

    expect(result.status).toBe("converged");
    expect(Math.abs(result.totalLift - targetLift) / targetLift).toBeLessThanOrEqual(result.settings.liftTolerance);
    expect(result.alphaDegrees).toBeGreaterThan(-5);
    expect(result.alphaDegrees).toBeLessThan(15);
  });

  it("returns a distinct max-iterations result instead of reporting false convergence", () => {
    const result = executeStaticAeroelasticAnalysis({
      resultId: "coupled-limited",
      aircraft,
      structuralDesign: design,
      materials: [material],
      density: 1.225,
      speed: 10,
      elasticAxisChordFraction: 0.4,
      condition: { mode: "fixed-alpha", alphaDegrees: 4 },
      settings: { maxIterations: 2, displacementTolerance: 1e-12, loadTolerance: 1e-12 },
    });

    expect(result.status).toBe("max-iterations");
    expect(result.iterations).toHaveLength(2);
  });

  it("includes airfoil pitching moment in the torsional deformation", () => {
    const result = executeStaticAeroelasticAnalysis({
      resultId: "coupled-section-moment",
      aircraft,
      structuralDesign: design,
      materials: [material],
      polars: [polar],
      density: 1.225,
      speed: 10,
      elasticAxisChordFraction: 0.25,
      condition: { mode: "fixed-alpha", alphaDegrees: 4 },
    });

    expect(result.structuralResult.points.at(-1)!.twist).toBeLessThan(0);
  });
});
