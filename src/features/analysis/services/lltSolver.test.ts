import { describe, expect, it } from "vitest";
import type { AircraftGeometry } from "../../aircraft/model/types";
import { calculateLltCoefficients } from "./lltSolver";

// Reference geometry and raw XFLR5 output are committed under
// fixtures/xflr5-6.62-flying-wing-llt/. The 10.15 rad^-1 section slope and
// -0.124 deg zero-lift angle characterize the low-angle MH45 polar embedded in
// the official sample project; this slice validates the finite-wing solution.
const xflr5FlyingWing: AircraftGeometry = {
  id: "xflr5-official-flying-wing",
  span: 2,
  rootChord: 0.3,
  tipChord: 0.12,
  taperRatio: 0.4,
  twist: 0,
  dihedral: 0,
  sweep: 26.565,
  incidence: 0,
  wingArea: 0.42,
  aspectRatio: 2 ** 2 / 0.42,
  mac: 0.215791,
  staticMargin: 0,
  sections: [
    { id: "root", yPosition: 0, chord: 0.3, xOffset: 0, twist: 0, dihedral: 0, airfoilId: "mh45", chordwisePanels: 11, spanwisePanels: 15, chordwiseDistribution: "cosine", spanwiseDistribution: "inverse-sine" },
    { id: "tip", yPosition: 1, chord: 0.12, xOffset: 0.5, twist: 0, dihedral: 0, airfoilId: "mh45", chordwisePanels: 11, spanwisePanels: 1, chordwiseDistribution: "cosine", spanwiseDistribution: "uniform" },
  ],
};

describe("calculateLltCoefficients", () => {
  it.each([
    { alpha: 0, cl: 0.014841 },
    { alpha: 0.5, cl: 0.077464 },
    { alpha: 1, cl: 0.127511 },
  ])("matches the XFLR5 6.62 low-angle lift curve at alpha $alpha", ({ alpha, cl }) => {
    const result = calculateLltCoefficients(xflr5FlyingWing, alpha, {
      sectionLiftCurveSlope: 10.15,
      zeroLiftAngle: -0.124,
      stationCount: 15,
    });

    expect(Math.abs(result.cl - cl)).toBeLessThan(Math.max(0.002, Math.abs(cl) * 0.08));
  });
});
