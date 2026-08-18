import { describe, expect, it } from "vitest";
import type { AircraftGeometry } from "../../aircraft/model/types";
import { createWingAnalysisMesh } from "./wingAnalysisMesh";
import { calculateVlmCoefficients } from "./vlmSolver";

// Reference input, commands, raw AVL output, and provenance are committed under
// fixtures/avl-3.52-simple-wing/. Values below are copied from total-forces.txt.
// AVL settings: 8 chordwise x 12 spanwise, cosine spacing, Mach 0, surface incidence 2 deg.
const avlWing: AircraftGeometry = {
  id: "avl-official-simple-wing",
  span: 15,
  rootChord: 2.2,
  tipChord: 1.8,
  taperRatio: 1.8 / 2.2,
  twist: 0,
  dihedral: Math.atan2(0.75, 7.5) * 180 / Math.PI,
  sweep: Math.atan2(0.4, 7.5) * 180 / Math.PI,
  incidence: 2,
  wingArea: 30,
  aspectRatio: 7.5,
  mac: 2,
  staticMargin: 0,
  sections: [
    { id: "root", yPosition: 0, chord: 2.2, xOffset: 0, twist: 0, dihedral: Math.atan2(0.75, 7.5) * 180 / Math.PI, airfoilId: "symmetric", chordwisePanels: 8, spanwisePanels: 12, chordwiseDistribution: "cosine", spanwiseDistribution: "cosine" },
    { id: "tip", yPosition: 7.5, chord: 1.8, xOffset: 0.4, twist: 0, dihedral: 0, airfoilId: "symmetric", chordwisePanels: 8, spanwisePanels: 12, chordwiseDistribution: "cosine", spanwiseDistribution: "cosine" },
  ],
};

describe("calculateVlmCoefficients", () => {
  it.each([
    { alpha: -2, cl: 0.00080, cdi: 0 },
    { alpha: 0, cl: 0.15984, cdi: 0.0011102 },
    { alpha: 2, cl: 0.31878, cdi: 0.0044283 },
  ])("matches AVL 3.52 forces for the official simple wing at alpha $alpha", ({ alpha, cl, cdi }) => {
    const result = calculateVlmCoefficients(avlWing, createWingAnalysisMesh(avlWing.sections), alpha);

    expect(Math.abs(result.cl - cl)).toBeLessThan(Math.max(0.002, Math.abs(cl) * 0.02));
    expect(Math.abs(result.cdi - cdi)).toBeLessThan(Math.max(0.0002, cdi * 0.1));
  });

  it("exposes panel circulation and load contributions that conserve the total coefficients", () => {
    const mesh = createWingAnalysisMesh(avlWing.sections);
    const result = calculateVlmCoefficients(avlWing, mesh, 2);

    expect(result.panelLoads).toHaveLength(mesh.panels.length);
    expect(result.panelLoads.every((load) => Number.isFinite(load.circulation))).toBe(true);
    expect(result.panelLoads.reduce((sum, load) => sum + load.cl, 0)).toBeCloseTo(result.cl, 10);
    expect(result.panelLoads.reduce((sum, load) => sum + load.cdi, 0)).toBeCloseTo(result.cdi, 10);
    expect(result.panelLoads.reduce((sum, load) => sum + load.cm, 0)).toBeCloseTo(result.cm, 10);
  });
});
