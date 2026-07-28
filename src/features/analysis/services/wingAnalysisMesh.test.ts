import { describe, expect, it } from "vitest";
import type { WingSection } from "../../aircraft/model/types";
import { createWingAnalysisMesh } from "./wingAnalysisMesh";

const sections: WingSection[] = [
  { id: "root", yPosition: 0, chord: 1, xOffset: 0, twist: 0, dihedral: 5, airfoilId: "af-1", chordwisePanels: 4, spanwisePanels: 3, chordwiseDistribution: "uniform", spanwiseDistribution: "uniform" },
  { id: "tip", yPosition: 2, chord: 0.5, xOffset: 0.4, twist: -4, dihedral: 0, airfoilId: "af-2", chordwisePanels: 4, spanwisePanels: 1, chordwiseDistribution: "uniform", spanwiseDistribution: "uniform" },
];

describe("wing analysis mesh", () => {
  it("creates symmetric panels using the section X and Y panel counts", () => {
    const mesh = createWingAnalysisMesh(sections);

    expect(mesh.panels).toHaveLength(4 * 3 * 2);
    expect(mesh.strips).toHaveLength(3);
    expect(mesh.panels.filter((panel) => panel.side === "right")).toHaveLength(12);
    expect(mesh.panels.filter((panel) => panel.side === "left")).toHaveLength(12);
  });

  it("places section points using offset, dihedral and quarter-chord twist", () => {
    const mesh = createWingAnalysisMesh(sections);
    const tipNodes = mesh.nodes.filter((node) => node.side === "right" && Math.abs(node.y - 2) < 1e-8);
    const tipQuarterChord = tipNodes.find((node) => Math.abs(node.chordFraction - 0.25) < 1e-8);

    expect(Math.min(...tipNodes.map((node) => node.x))).toBeGreaterThan(0.39);
    expect(Math.min(...tipNodes.map((node) => node.z))).not.toBeCloseTo(Math.max(...tipNodes.map((node) => node.z)), 8);
    expect(tipQuarterChord?.z).toBeCloseTo(2 * Math.tan(5 * Math.PI / 180), 8);
  });
});
