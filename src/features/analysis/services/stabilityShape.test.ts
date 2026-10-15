import { describe, expect, it } from "vitest";
import { createWingAnalysisMesh } from "./wingAnalysisMesh";
import { createStabilityWingMesh } from "./stabilityShape";

const sections = [0, 2].map((yPosition, index) => ({ id: `s${index}`, yPosition, chord: 1, xOffset: 0, twist: 0,
  dihedral: 0, airfoilId: "foil", chordwisePanels: 2, spanwisePanels: 2,
  chordwiseDistribution: "uniform" as const, spanwiseDistribution: "uniform" as const }));
const aircraft = { id: "wing", sections, span: 4, wingArea: 4, mac: 1, rootChord: 1, tipChord: 1,
  aspectRatio: 4, taperRatio: 1, twist: 0, dihedral: 0, sweep: 0, incidence: 0, staticMargin: 0 };

describe("createStabilityWingMesh", () => {
  it("interpolates symmetric deflection and twist without changing the original mesh", () => {
    const original = createWingAnalysisMesh(sections);
    const mesh = createStabilityWingMesh(aircraft, { kind: "manual", elasticAxisChordFraction: 0.5,
      points: [{ yPosition: 0, deflection: 0, twist: 0 }, { yPosition: 2, deflection: 0.4, twist: -10 }] });
    const at = (y: number, fraction: number) => mesh.nodes.find((n) => n.y === y && n.chordFraction === fraction)!;
    expect(at(1, 0.5).z).toBeCloseTo(0.2, 8);
    expect(at(-1, 0.5).z).toBeCloseTo(0.2, 8);
    expect(at(2, 1).z).toBeCloseTo(0.4 + 0.5 * Math.sin(Math.PI / 18), 8);
    expect(mesh.panels.some((p) => p.corners.some((n) => n.z > 0.1))).toBe(true);
    expect(original.nodes.every((n) => n.z === 0)).toBe(true);
  });

  it("uses the frozen FSI mesh and rejects a shape from a different geometry", () => {
    const wingMesh = createWingAnalysisMesh(sections);
    wingMesh.nodes.forEach((node) => { node.z += Math.abs(node.y) * 0.1; });
    const shape = { kind: "fsi" as const, resultId: "fsi-1", createdAt: "2026-10-16T00:00:00Z", speed: 10, alphaDegrees: 2,
      aircraftSnapshot: aircraft, wingMesh };
    expect(createStabilityWingMesh(aircraft, shape)).toEqual(wingMesh);
    expect(() => createStabilityWingMesh({ ...aircraft, incidence: 2 }, shape)).toThrow(/機体形状/);
  });
});
