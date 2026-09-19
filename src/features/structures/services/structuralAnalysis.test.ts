import { describe, expect, it } from "vitest";
import type { CarbonMaterial, StructuralDesign, StructuralLoadCase } from "../model/types";
import { calculateLaminate, calculateStructuralDesignProperties, calculateTubeLinearMass, executeStructuralAnalysis } from "./structuralAnalysis";

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

  it("treats a supplied ply stack as the local laminate without smearing partial coverage", () => {
    const full = calculateLaminate([
      { id: "full", materialId: isotropic.id, angle: 0, count: 1, partialAngle: 90, partialWidth: 0.15 },
    ], new Map([[isotropic.id, isotropic]]));
    const halfWidth = calculateLaminate([
      { id: "partial", materialId: isotropic.id, angle: 0, count: 1, partialAngle: 45, partialWidth: 0.075 },
    ], new Map([[isotropic.id, isotropic]]));

    expect(halfWidth.thickness).toBe(full.thickness);
    expect(halfWidth.arealMass).toBeCloseTo(full.arealMass, 10);
    expect(halfWidth.a[0][0]).toBeCloseTo(full.a[0][0], 5);
  });
});

describe("calculateTubeLinearMass", () => {
  it("uses the two recorded cap widths for a partial ply", () => {
    const section = {
      id: "partial-cap", length: 1, outerDiameter: 0.1,
      plies: [{ id: "cap", materialId: isotropic.id, angle: 0 as const, count: 1, partialAngle: 30, partialWidth: 0.02 }],
    };

    expect(calculateTubeLinearMass(section, new Map([[isotropic.id, isotropic]]))).toBeCloseTo(isotropic.density * isotropic.plyThickness * 0.04, 10);
  });
});

describe("calculateStructuralDesignProperties", () => {
  it("derives each bending failure strength and stiffness directly from the current pipe design", () => {
    const points = calculateStructuralDesignProperties(design, [isotropic]);

    expect(points).toHaveLength(2);
    expect(points.map((point) => point.yPosition)).toEqual([0, 1]);
    expect(points[0].laminateBendingStrength).toBeGreaterThan(0);
    expect(points[0].localBucklingStrength).toBeGreaterThan(0);
    expect(points[0].brazierStrength).toBeGreaterThan(0);
    expect(points[0].laminateFailureMode).toBe("繊維圧縮");
    expect(points[0].laminateFailurePlyId).toBe("ply-main");
    expect(points[0].governingBendingStrength).toBe(Math.min(
      points[0].laminateBendingStrength,
      points[0].localBucklingStrength!,
      points[0].brazierStrength!,
    ));
    expect(points[0].bendingStiffness).toBeGreaterThan(0);
    expect(points[0].sectionId).toBe("section-main");
  });

  it("updates the relevant properties when pipe geometry or material design changes", () => {
    const baseline = calculateStructuralDesignProperties(design, [isotropic])[0];
    const enlarged = calculateStructuralDesignProperties({
      ...design,
      sections: design.sections.map((section) => ({ ...section, outerDiameter: section.outerDiameter * 1.2 })),
    }, [isotropic])[0];
    const stronger = calculateStructuralDesignProperties(design, [{
      ...isotropic,
      tensileStrength1: isotropic.tensileStrength1 * 1.2,
      compressiveStrength1: isotropic.compressiveStrength1 * 1.2,
      tensileStrength2: isotropic.tensileStrength2 * 1.2,
      compressiveStrength2: isotropic.compressiveStrength2 * 1.2,
      shearStrength12: isotropic.shearStrength12 * 1.2,
    }])[0];

    expect(enlarged.bendingStiffness).toBeGreaterThan(baseline.bendingStiffness);
    expect(stronger.laminateBendingStrength).toBeGreaterThan(baseline.laminateBendingStrength);
  });
});

describe("executeStructuralAnalysis", () => {
  it("integrates upper and lower partial caps at their actual circumferential positions", () => {
    const thinMaterial = { ...isotropic, id: "thin-isotropic", plyThickness: 0.0001 };
    const partialDesign: StructuralDesign = {
      ...design,
      sections: [{
        id: "partial-section",
        length: 1,
        outerDiameter: 0.1,
        plies: [
          { id: "base", materialId: thinMaterial.id, angle: 0, count: 1, partialAngle: 90 },
          { id: "cap", materialId: thinMaterial.id, angle: 0, count: 1, partialAngle: 45 },
        ],
      }],
    };
    const loadCase: StructuralLoadCase = { id: "zero", name: "断面特性", source: "manual", loadFactor: 1, safetyFactor: 1, distributedLoads: [], pointLoads: [], status: "not-run" };

    const point = executeStructuralAnalysis({ design: partialDesign, loadCase, materials: [thinMaterial], resultId: "partial-result", sampleCount: 3 }).points[0];
    const innerRadius = 0.05 - 2 * thinMaterial.plyThickness;
    const baseOuterRadius = innerRadius + thinMaterial.plyThickness;
    const capOuterRadius = baseOuterRadius + thinMaterial.plyThickness;
    const alpha = Math.PI / 4;
    const baseSecondMoment = Math.PI * (baseOuterRadius ** 4 - innerRadius ** 4) / 4;
    const capSecondMoment = (2 * alpha + Math.sin(2 * alpha)) * (capOuterRadius ** 4 - baseOuterRadius ** 4) / 4;

    expect(point.ei).toBeCloseTo(thinMaterial.e1 * (baseSecondMoment + capSecondMoment), 3);
  });

  it("uses the exact cap-edge geometry for partial-ply bending capacity", () => {
    const capMaterial = { ...isotropic, id: "cap-strength", plyThickness: 0.0001, tensileStrength1: 20e6, compressiveStrength1: 10e6 };
    const partialDesign: StructuralDesign = {
      ...design,
      sections: [{
        id: "partial-strength-section",
        length: 1,
        outerDiameter: 0.1,
        plies: [
          { id: "base", materialId: capMaterial.id, angle: 0, count: 1, partialAngle: 90 },
          { id: "cap", materialId: capMaterial.id, angle: 0, count: 1, partialAngle: 45 },
        ],
      }],
    };
    const loadCase: StructuralLoadCase = { id: "tip", name: "部分積層強度", source: "manual", loadFactor: 1, safetyFactor: 1, distributedLoads: [], pointLoads: [{ id: "tip", yPosition: 1, force: 1, torque: 0 }], status: "not-run" };

    const point = executeStructuralAnalysis({ design: partialDesign, loadCase, materials: [capMaterial], resultId: "partial-strength", sampleCount: 3 }).points[0];
    const expectedCapacity = capMaterial.compressiveStrength1 * point.ei / capMaterial.e1 / 0.05;

    expect(point.bendingMomentCapacity).toBeCloseTo(expectedCapacity, 2);
    expect(point.localBucklingReserveFactor).toBeUndefined();
    expect(point.brazierReserveFactor).toBeUndefined();
  });

  it("uses the weaker compression-side strength for CFRP tube bending", () => {
    const compressionCritical = {
      ...isotropic,
      id: "compression-critical",
      tensileStrength1: 900e6,
      compressiveStrength1: 90e6,
    };
    const compressionDesign: StructuralDesign = {
      ...design,
      sections: [{
        ...design.sections[0],
        plies: [{ id: "compression-ply", materialId: compressionCritical.id, angle: 0, count: 4 }],
      }],
    };
    const loadCase: StructuralLoadCase = {
      id: "compression-load", name: "圧縮側支配", source: "manual", loadFactor: 1, safetyFactor: 1,
      distributedLoads: [], pointLoads: [{ id: "tip", yPosition: 1, force: 100, torque: 0 }], status: "not-run",
    };

    const result = executeStructuralAnalysis({ design: compressionDesign, loadCase, materials: [compressionCritical], resultId: "compression-result", sampleCount: 5 });

    expect(result.summary.governingPlyId).toBe("compression-ply");
    expect(result.summary.governingMode).toBe("繊維圧縮");
    const innerDiameter = 0.1 - 2 * compressionCritical.plyThickness * 4;
    const secondMoment = Math.PI * (0.1 ** 4 - innerDiameter ** 4) / 64;
    expect(result.points[0].bendingMomentCapacity).toBeCloseTo(compressionCritical.compressiveStrength1 * secondMoment / 0.05, 6);
  });

  it("combines bending and torsion in one ply failure reserve factor", () => {
    const combinedDesign: StructuralDesign = {
      ...design,
      sections: [{
        ...design.sections[0],
        plies: [
          { id: "axial-ply", materialId: isotropic.id, angle: 0, count: 2 },
          { id: "angle-ply", materialId: isotropic.id, angle: 45, count: 2 },
        ],
      }],
    };
    const analyze = (force: number, torque: number) => executeStructuralAnalysis({
      design: combinedDesign,
      loadCase: {
        id: `load-${force}-${torque}`, name: "複合荷重", source: "manual", loadFactor: 1, safetyFactor: 1,
        distributedLoads: [], pointLoads: [{ id: "tip", yPosition: 1, force, torque }], status: "not-run",
      },
      materials: [isotropic], resultId: `result-${force}-${torque}`, sampleCount: 5,
    }).points[0].minReserveFactor;

    const bendingOnly = analyze(100, 0);
    const torsionOnly = analyze(0, 100);
    const combined = analyze(100, 100);

    expect(combined).toBeLessThan(bendingOnly);
    expect(combined).toBeLessThan(torsionOnly);
  });

  it("recovers ply stresses from laminate strain compatibility", () => {
    const stiffStrong = { ...isotropic, id: "stiff-strong", e1: 140e9, tensileStrength1: 1000e6, compressiveStrength1: 1000e6 };
    const compliantWeak = { ...isotropic, id: "compliant-weak", e1: 7e9, tensileStrength1: 100e6, compressiveStrength1: 100e6 };
    const mixedDesign: StructuralDesign = {
      ...design,
      sections: [{
        ...design.sections[0],
        plies: [
          { id: "stiff-ply", materialId: stiffStrong.id, angle: 0, count: 2 },
          { id: "compliant-ply", materialId: compliantWeak.id, angle: 0, count: 2 },
        ],
      }],
    };
    const loadCase: StructuralLoadCase = {
      id: "strain-compatible-load", name: "ひずみ適合", source: "manual", loadFactor: 1, safetyFactor: 1,
      distributedLoads: [], pointLoads: [{ id: "tip", yPosition: 1, force: 100, torque: 0 }], status: "not-run",
    };

    const result = executeStructuralAnalysis({ design: mixedDesign, loadCase, materials: [stiffStrong, compliantWeak], resultId: "strain-compatible", sampleCount: 5 });

    expect(result.summary.governingPlyId).toBe("stiff-ply");
  });

  it("screens thin tubes for local shell buckling and Brazier ovalization", () => {
    const veryStrong = {
      ...isotropic,
      id: "very-strong",
      tensileStrength1: 1e15,
      compressiveStrength1: 1e15,
      tensileStrength2: 1e15,
      compressiveStrength2: 1e15,
      shearStrength12: 1e15,
      plyThickness: 0.0001,
    };
    const thinDesign: StructuralDesign = {
      ...design,
      sections: [{ ...design.sections[0], plies: [{ id: "thin-ply", materialId: veryStrong.id, angle: 0, count: 1 }] }],
    };
    const loadCase: StructuralLoadCase = {
      id: "shell-load", name: "薄肉シェル", source: "manual", loadFactor: 1, safetyFactor: 1,
      distributedLoads: [], pointLoads: [{ id: "tip", yPosition: 1, force: 100, torque: 0 }], status: "not-run",
    };

    const root = executeStructuralAnalysis({ design: thinDesign, loadCase, materials: [veryStrong], resultId: "shell-result", sampleCount: 5 }).points[0];

    expect(root.localBucklingReserveFactor).toBeGreaterThan(0);
    expect(root.brazierReserveFactor).toBeGreaterThan(0);
    expect(root.minReserveFactor).toBe(Math.min(root.localBucklingReserveFactor!, root.brazierReserveFactor!));
  });

  it("lets a weak transverse ply govern the laminate bending capacity", () => {
    const weakHoop = { ...isotropic, id: "weak-hoop", tensileStrength2: 1e6, compressiveStrength2: 1e6 };
    const excelDesign = {
      id: "excel-design",
      name: "Excel準拠桁",
      sections: [{
        id: "excel-section",
        length: 1,
        outerDiameter: 0.1,
        plies: [
          { id: "hoop", materialId: weakHoop.id, angle: 90, count: 1 },
          { id: "axial", materialId: isotropic.id, angle: 0, count: 2 },
        ],
      }],
      loadCases: [],
    } satisfies StructuralDesign;
    const loadCase: StructuralLoadCase = {
      id: "excel-load",
      name: "Excel曲げ耐力確認",
      source: "manual",
      loadFactor: 1,
      safetyFactor: 1,
      distributedLoads: [],
      pointLoads: [{ id: "tip-load", yPosition: 1, force: 100, torque: 0 }],
      status: "not-run",
    };

    const result = executeStructuralAnalysis({ design: excelDesign, loadCase, materials: [isotropic, weakHoop], resultId: "excel-result", sampleCount: 5 });
    const root = result.points[0];
    expect(root.bendingMomentCapacity).toBeLessThan(30);
    expect(root.minReserveFactor).toBeCloseTo(root.bendingMomentCapacity! / 100, 6);
    expect(result.summary.governingMode).toMatch(/^母材/);
    expect(result.summary.governingPlyId).toBe("hoop");
  });

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
    const area = Math.PI * (0.1 ** 2 - innerDiameter ** 2) / 4;
    const expectedShearDeflection = 100 / (0.5 * isotropic.g12 * area);
    const expectedBendingCapacity = isotropic.compressiveStrength1 * secondMoment / 0.05;

    expect(root.shearForce).toBeCloseTo(100, 6);
    expect(root.bendingMoment).toBeCloseTo(100, 4);
    expect(root.bendingMomentCapacity!).toBeCloseTo(expectedBendingCapacity, 4);
    expect(root.bendingReserveFactor!).toBeCloseTo(expectedBendingCapacity / root.bendingMoment, 4);
    expect(tip.deflection - expectedDeflection).toBeCloseTo(expectedShearDeflection, 8);
    expect(result.summary.reactionForce).toBeCloseTo(-100, 6);
    expect(result.summary.forceBalanceError).toBeLessThan(1e-8);
  });

  it("matches uniform-shaft twist and evaluates its ply failure reserve factor", () => {
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

    expect(result.summary.maxTwist).toBeCloseTo(expectedTwist * 180 / Math.PI, 3);
    expect(result.points.at(-1)!.twist).toBeCloseTo(expectedTwist * 180 / Math.PI, 3);
    expect(result.points[0].torqueCapacity!).toBeCloseTo(expectedTorqueCapacity, 4);
    expect(result.points[0].torsionReserveFactor!).toBeCloseTo(expectedTorqueCapacity / 75, 4);
    expect(result.summary.minReserveFactor).toBeCloseTo(expectedTorqueCapacity / 75, 4);
    expect(result.summary.governingPlyId).toBe("ply-main");
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
