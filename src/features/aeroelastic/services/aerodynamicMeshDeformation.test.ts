import { describe, expect, it } from "vitest";
import type { WingSection } from "../../aircraft/model/types";
import { createWingAnalysisMesh } from "../../analysis/services/wingAnalysisMesh";
import { deformWingAnalysisMesh } from "./aerodynamicMeshDeformation";

const sections: WingSection[] = [
  { id: "root", yPosition: 0, chord: 1, xOffset: 0, twist: 0, dihedral: 0, airfoilId: "af", chordwisePanels: 2, spanwisePanels: 2, chordwiseDistribution: "uniform", spanwiseDistribution: "uniform" },
  { id: "tip", yPosition: 2, chord: 1, xOffset: 0, twist: 0, dihedral: 0, airfoilId: "af", chordwisePanels: 2, spanwisePanels: 2, chordwiseDistribution: "uniform", spanwiseDistribution: "uniform" },
];

describe("deformWingAnalysisMesh", () => {
  it("preserves the original mesh for zero beam deformation", () => {
    const mesh = createWingAnalysisMesh(sections);

    const deformed = deformWingAnalysisMesh(mesh, [
      { yPosition: 0, deflection: 0, rotation: 0, twist: 0 },
      { yPosition: 2, deflection: 0, rotation: 0, twist: 0 },
    ], 0.4);

    expect(deformed).toEqual(mesh);
    expect(deformed).not.toBe(mesh);
  });

  it("translates the elastic axis and twists chord points without mutating the source mesh", () => {
    const mesh = createWingAnalysisMesh(sections);
    const originalTip = mesh.nodes.find((node) => node.side === "right" && node.y === 2 && node.chordFraction === 1)!;

    const deformed = deformWingAnalysisMesh(mesh, [
      { yPosition: 0, deflection: 0, rotation: 0, twist: 0 },
      { yPosition: 2, deflection: 0.2, rotation: 0.1, twist: 0.1 },
    ], 0.4);
    const tipAxis = deformed.nodes.find((node) => node.side === "right" && node.y === 2 && node.chordFraction === 0.5)!;
    const tipTrailing = deformed.nodes.find((node) => node.side === "right" && node.y === 2 && node.chordFraction === 1)!;

    expect(originalTip).toMatchObject({ x: 1, z: 0 });
    expect(tipAxis.z).toBeCloseTo(0.2 - 0.1 * Math.sin(0.1), 8);
    expect(tipTrailing.x).toBeCloseTo(0.4 + 0.6 * Math.cos(0.1), 8);
    expect(tipTrailing.z).toBeCloseTo(0.2 - 0.6 * Math.sin(0.1), 8);
    expect(deformed.strips[1].twist).toBeGreaterThan(mesh.strips[1].twist);
  });
});
