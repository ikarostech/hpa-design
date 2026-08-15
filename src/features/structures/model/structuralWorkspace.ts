import type { AircraftGeometry } from "../../aircraft/model/types";
import type { CarbonMaterial, StructuralDesign, StructuralTubeSection } from "./types";
import { calculateLaminate } from "../services/structuralAnalysis";

export function createStructuralId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultMaterial(): CarbonMaterial {
  return {
    id: createStructuralId("material"),
    name: "新規カーボン材料",
    e1: 120e9,
    e2: 8e9,
    g12: 4e9,
    nu12: 0.3,
    tensileStrength1: 1200e6,
    compressiveStrength1: 700e6,
    tensileStrength2: 40e6,
    compressiveStrength2: 120e6,
    shearStrength12: 60e6,
    density: 1550,
    plyThickness: 0.000125,
    reductionFactor: 0.8,
  };
}

export function createDefaultStructuralDesign(aircraft: AircraftGeometry, material?: CarbonMaterial): StructuralDesign {
  const materialId = material?.id ?? "";
  const halfSpan = aircraft.span / 2;
  return {
    id: createStructuralId("structure"),
    name: "新規メインパイプ",
    sections: [
      { id: createStructuralId("section"), length: halfSpan / 2, outerDiameter: 0.08, plies: [{ id: createStructuralId("ply"), materialId, angle: 0, count: 6 }] },
      { id: createStructuralId("section"), length: halfSpan / 2, outerDiameter: 0.04, plies: [{ id: createStructuralId("ply"), materialId, angle: 0, count: 4 }] },
    ],
    loadCases: [],
  };
}

export function createTubeSection(material?: CarbonMaterial): StructuralTubeSection {
  return {
    id: createStructuralId("section"),
    length: 0.5,
    outerDiameter: 0.05,
    plies: [{ id: createStructuralId("ply"), materialId: material?.id ?? "", angle: 0, count: 4 }],
  };
}

export function getSectionSummary(section: StructuralTubeSection, materials: readonly CarbonMaterial[]) {
  try {
    const laminate = calculateLaminate(section.plies, new Map(materials.map((material) => [material.id, material])));
    const innerDiameter = section.outerDiameter - 2 * laminate.thickness;
    return {
      thickness: laminate.thickness,
      innerDiameter,
      linearMass: laminate.arealMass * Math.PI * (section.outerDiameter - laminate.thickness),
    };
  } catch {
    return null;
  }
}

export function structuralSpan(design: StructuralDesign) {
  return design.sections.reduce((sum, section) => sum + section.length, 0);
}

export function materialReferenceCount(designs: readonly StructuralDesign[], materialId: string | null) {
  return materialId
    ? designs.flatMap((design) => design.sections).filter((section) => section.plies.some((ply) => ply.materialId === materialId)).length
    : 0;
}

export function tubeSectionBounds(sections: readonly StructuralTubeSection[]) {
  let start = 0;
  return sections.map((section) => {
    const bound = { section, start, end: start + section.length };
    start = bound.end;
    return bound;
  });
}
