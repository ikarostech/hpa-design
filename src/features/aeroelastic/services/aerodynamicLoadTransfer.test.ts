import { describe, expect, it } from "vitest";
import type { AircraftGeometry } from "../../aircraft/model/types";
import { calculateVlmCoefficients } from "../../analysis/services/vlmSolver";
import { createWingAnalysisMesh } from "../../analysis/services/wingAnalysisMesh";
import { transferVlmLoadsToBeam } from "./aerodynamicLoadTransfer";

const aircraft: AircraftGeometry = {
  id: "rectangular-wing",
  span: 4,
  rootChord: 1,
  tipChord: 1,
  taperRatio: 1,
  twist: 0,
  dihedral: 0,
  sweep: 0,
  incidence: 0,
  wingArea: 4,
  aspectRatio: 4,
  mac: 1,
  staticMargin: 0,
  sections: [
    { id: "root", yPosition: 0, chord: 1, xOffset: 0, twist: 0, dihedral: 0, airfoilId: "symmetric", chordwisePanels: 2, spanwisePanels: 4, chordwiseDistribution: "uniform", spanwiseDistribution: "uniform" },
    { id: "tip", yPosition: 2, chord: 1, xOffset: 0, twist: 0, dihedral: 0, airfoilId: "symmetric", chordwisePanels: 2, spanwisePanels: 4, chordwiseDistribution: "uniform", spanwiseDistribution: "uniform" },
  ],
};

describe("transferVlmLoadsToBeam", () => {
  it("conserves right-half lift and elastic-axis torque", () => {
    const density = 1.2;
    const speed = 10;
    const elasticAxisChordFraction = 0.4;
    const mesh = createWingAnalysisMesh(aircraft.sections);
    const aerodynamic = calculateVlmCoefficients(aircraft, mesh, 4);

    const transferred = transferVlmLoadsToBeam({
      aircraft,
      mesh,
      panelLoads: aerodynamic.panelLoads,
      density,
      speed,
      elasticAxisChordFraction,
    });

    const dynamicPressure = density * speed ** 2 / 2;
    const expectedHalfLift = dynamicPressure * aircraft.wingArea * aerodynamic.cl / 2;
    const integratedLift = transferred.points.reduce((sum, point) => sum + point.liftPerLength * point.width, 0);
    const integratedTorque = transferred.points.reduce((sum, point) => sum + point.torquePerLength * point.width, 0);
    const expectedTorque = aerodynamic.panelLoads
      .filter((load) => load.side === "right")
      .reduce((sum, load) => sum + (elasticAxisChordFraction - load.applicationPoint.x) * dynamicPressure * aircraft.wingArea * load.cl, 0);

    expect(transferred.points).toHaveLength(mesh.strips.length);
    expect(integratedLift).toBeCloseTo(expectedHalfLift, 8);
    expect(integratedTorque).toBeCloseTo(expectedTorque, 8);
    expect(transferred.forceBalanceError).toBeLessThan(1e-9);
    expect(transferred.momentBalanceError).toBeLessThan(1e-9);
  });

  it("adds sectional pitching moment about the elastic axis", () => {
    const density = 1.2;
    const speed = 10;
    const mesh = createWingAnalysisMesh(aircraft.sections);
    const aerodynamic = calculateVlmCoefficients(aircraft, mesh, 4);
    const baseline = transferVlmLoadsToBeam({ aircraft, mesh, panelLoads: aerodynamic.panelLoads, density, speed, elasticAxisChordFraction: 0.4 });
    const withSectionMoment = transferVlmLoadsToBeam({ aircraft, mesh, panelLoads: aerodynamic.panelLoads, density, speed, elasticAxisChordFraction: 0.4, sectionMomentCoefficients: mesh.strips.map(() => 0.1) });
    const integrated = (points: typeof baseline.points) => points.reduce((sum, point) => sum + point.torquePerLength * point.width, 0);
    const expectedSectionMoment = density * speed ** 2 / 2 * mesh.strips.reduce((sum, strip) => sum + 0.1 * strip.chord ** 2 * (strip.yEnd - strip.yStart), 0);

    expect(integrated(withSectionMoment.points) - integrated(baseline.points)).toBeCloseTo(expectedSectionMoment, 8);
  });
});
