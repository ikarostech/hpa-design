import { describe, expect, it } from "vitest";
import type { CarbonMaterial, StructuralDesign, StructuralLoadCase } from "../model/types";
import { calculateLaminate, executeStructuralAnalysis } from "./structuralAnalysis";

const isotropic: CarbonMaterial = {
  id: "material-1",
  name: "検証用等方材",
  e1: 70e9,
  e2: 70e9,
  g12: 26.315789e9,
  nu12: 0.33,
  tensileStrength1: 600e6,
  compressiveStrength1: 500e6,
  tensileStrength2: 600e6,
  compressiveStrength2: 500e6,
  shearStrength12: 250e6,
  density: 1600,
  plyThickness: 0.001,
  reductionFactor: 1,
};

const design: StructuralDesign = {
  id: "structure-1",
  name: "検証用パイプ",
  sections: [
    { id: "section-main", length: 1, outerDiameter: 0.1, plies: [{ id: "ply-main", materialId: isotropic.id, angle: 0, count: 4 }] },
  ],
  loadCases: [],
};

describe("calculateLaminate", () => {
  it("returns a near-zero B matrix for a symmetric laminate", () => {
    const laminate = calculateLaminate([
      { id: "p1", materialId: isotropic.id, angle: 0, count: 1 },
      { id: "p2", materialId: isotropic.id, angle: 45, count: 1 },
      { id: "p3", materialId: isotropic.id, angle: 45, count: 1 },
      { id: "p4", materialId: isotropic.id, angle: 0, count: 1 },
    ], new Map([[isotropic.id, isotropic]]));

    expect(Math.max(...laminate.b.flat().map(Math.abs))).toBeLessThan(1e-5);
    expect(laminate.thickness).toBeCloseTo(0.004, 10);
  });
});

describe("executeStructuralAnalysis", () => {
  it("keeps each CFRP tube section constant and switches properties only at its length boundary", () => {
    const sectionDesign = {
      id: "section-design",
      name: "定尺パイプ",
      sections: [
        { id: "tube-root", length: 0.5, outerDiameter: 0.1, plies: [{ id: "root-ply", materialId: isotropic.id, angle: 0, count: 4 }] },
        { id: "tube-tip", length: 0.5, outerDiameter: 0.05, plies: [{ id: "tip-ply", materialId: isotropic.id, angle: 0, count: 8 }] },
      ],
      loadCases: [],
    } satisfies StructuralDesign;
    const loadCase: StructuralLoadCase = { id: "section-load", name: "境界確認", source: "manual", loadFactor: 1, safetyFactor: 1, distributedLoads: [], pointLoads: [], status: "not-run" };

    const result = executeStructuralAnalysis({ design: sectionDesign, loadCase, materials: [isotropic], resultId: "section-result", sampleCount: 5 });

    expect(result.points.map((point) => point.yPosition)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(result.points[1].outerDiameter).toBe(0.1);
    expect(result.points[2].outerDiameter).toBe(0.05);
    expect(result.points[3].outerDiameter).toBe(0.05);
    expect(result.points[1].thickness).toBeCloseTo(0.004, 10);
    expect(result.points[2].thickness).toBeCloseTo(0.008, 10);
  });

  it("matches cantilever tip-load deflection and force balance", () => {
    const loadCase: StructuralLoadCase = {
      id: "load-tip",
      name: "先端集中荷重",
      source: "manual",
      loadFactor: 1,
      safetyFactor: 1,
      distributedLoads: [{ yPosition: 0, liftPerLength: 0, torquePerLength: 0 }, { yPosition: 1, liftPerLength: 0, torquePerLength: 0 }],
      pointLoads: [{ id: "point-1", yPosition: 1, force: 100, torque: 0 }],
      status: "not-run",
    };

    const result = executeStructuralAnalysis({ design, loadCase, materials: [isotropic], resultId: "result-1", sampleCount: 401 });
    const root = result.points[0];
    const tip = result.points.at(-1)!;
    const innerDiameter = 0.1 - 2 * 0.004;
    const secondMoment = Math.PI * (0.1 ** 4 - innerDiameter ** 4) / 64;
    const expectedDeflection = 100 / (3 * isotropic.e1 * secondMoment);
    const expectedBendingCapacity = Math.min(isotropic.tensileStrength1, isotropic.compressiveStrength1) * secondMoment / 0.05;

    expect(root.shearForce).toBeCloseTo(100, 6);
    expect(root.bendingMoment).toBeCloseTo(100, 4);
    expect(root.bendingMomentCapacity!).toBeCloseTo(expectedBendingCapacity, 4);
    expect(root.bendingReserveFactor!).toBeCloseTo(expectedBendingCapacity / root.bendingMoment, 4);
    expect(tip.deflection).toBeCloseTo(expectedDeflection, 3);
    expect(result.summary.reactionForce).toBeCloseTo(-100, 6);
    expect(result.summary.forceBalanceError).toBeLessThan(1e-8);
  });

  it("matches uniform-shaft twist and identifies the governing reserve factor", () => {
    const loadCase: StructuralLoadCase = {
      id: "load-torque",
      name: "先端トルク",
      source: "manual",
      loadFactor: 1,
      safetyFactor: 1.5,
      distributedLoads: [{ yPosition: 0, liftPerLength: 0, torquePerLength: 0 }, { yPosition: 1, liftPerLength: 0, torquePerLength: 0 }],
      pointLoads: [{ id: "point-2", yPosition: 1, force: 0, torque: 50 }],
      status: "not-run",
    };

    const result = executeStructuralAnalysis({ design, loadCase, materials: [isotropic], resultId: "result-2", sampleCount: 401 });
    const innerDiameter = 0.1 - 2 * 0.004;
    const polarMoment = Math.PI * (0.1 ** 4 - innerDiameter ** 4) / 32;
    const expectedTwist = 50 * 1.5 / (isotropic.g12 * polarMoment);
    const expectedTorqueCapacity = isotropic.shearStrength12 * polarMoment / 0.05;

    expect(result.summary.maxTwist).toBeCloseTo(expectedTwist, 3);
    expect(result.points[0].torqueCapacity!).toBeCloseTo(expectedTorqueCapacity, 4);
    expect(result.points[0].torsionReserveFactor!).toBeCloseTo(expectedTorqueCapacity / 75, 4);
    expect(result.summary.minReserveFactor).toBeGreaterThan(0);
    expect(result.summary.governingMode).toBe("せん断");
    expect(result.summary.governingLoadCase).toBe(loadCase.name);
  });

  it("includes an interior point load in the inboard shear and moment", () => {
    const loadCase: StructuralLoadCase = {
      id: "load-interior", name: "途中集中荷重", source: "manual", loadFactor: 1, safetyFactor: 1,
      distributedLoads: [{ yPosition: 0, liftPerLength: 0, torquePerLength: 0 }, { yPosition: 1, liftPerLength: 0, torquePerLength: 0 }],
      pointLoads: [{ id: "point-mid", yPosition: 0.5, force: 100, torque: 0 }], status: "not-run",
    };

    const result = executeStructuralAnalysis({ design, loadCase, materials: [isotropic], resultId: "result-mid", sampleCount: 5 });

    expect(result.points[0].shearForce).toBeCloseTo(100, 8);
    expect(result.points[0].bendingMoment).toBeCloseTo(50, 8);
    expect(result.points[3].shearForce).toBeCloseTo(0, 8);
  });

  it("matches the uniform-load cantilever solution", () => {
    const loadCase: StructuralLoadCase = {
      id: "load-uniform", name: "一様分布荷重", source: "manual", loadFactor: 1, safetyFactor: 1,
      distributedLoads: [{ yPosition: 0, liftPerLength: 80, torquePerLength: 0 }, { yPosition: 1, liftPerLength: 80, torquePerLength: 0 }],
      pointLoads: [], status: "not-run",
    };
    const result = executeStructuralAnalysis({ design, loadCase, materials: [isotropic], resultId: "result-uniform", sampleCount: 801 });
    const innerDiameter = 0.1 - 2 * 0.004;
    const secondMoment = Math.PI * (0.1 ** 4 - innerDiameter ** 4) / 64;
    const expectedTipDeflection = 80 / (8 * isotropic.e1 * secondMoment);

    expect(result.points[0].shearForce).toBeCloseTo(80, 6);
    expect(result.points[0].bendingMoment).toBeCloseTo(40, 5);
    expect(result.summary.maxDeflection).toBeCloseTo(expectedTipDeflection, 3);
  });

  it("rejects non-physical material properties", () => {
    const loadCase: StructuralLoadCase = { id: "load-zero", name: "Zero", source: "manual", loadFactor: 1, safetyFactor: 1, distributedLoads: [], pointLoads: [], status: "not-run" };

    expect(() => executeStructuralAnalysis({ design, loadCase, materials: [{ ...isotropic, plyThickness: -0.001 }], resultId: "invalid" })).toThrow("材料プロパティ");
  });

  it("enforces zero displacement at a rigid strut support", () => {
    const supported = { ...design, supports: [{ id: "strut-1", yPosition: 0.5, kind: "rigid" as const }] };
    const loadCase: StructuralLoadCase = { id: "load-supported", name: "支柱付き", source: "manual", loadFactor: 1, safetyFactor: 1, distributedLoads: [], pointLoads: [{ id: "tip-load", yPosition: 1, force: 100, torque: 0 }], status: "not-run" };

    const result = executeStructuralAnalysis({ design: supported, loadCase, materials: [isotropic], resultId: "supported", sampleCount: 401 });
    const supportPoint = result.points.find((point) => Math.abs(point.yPosition - 0.5) < 1e-8)!;

    expect(supportPoint.deflection).toBeCloseTo(0, 8);
    expect(result.summary.supportReactions?.[0].force).toBeLessThan(0);
  });
});
