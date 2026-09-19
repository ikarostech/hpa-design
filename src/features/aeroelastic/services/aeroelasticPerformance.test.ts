import { describe, expect, it } from "vitest";
import type { AirfoilPolar } from "../../airfoils/model/types";
import type { WingMeshStrip } from "../../analysis/services/wingAnalysisMesh";
import { estimateAeroelasticPerformance } from "./aeroelasticPerformance";

const polar = (airfoilId: string, lowerCd: number, upperCd: number, status: AirfoilPolar["status"] = "complete"): AirfoilPolar => ({
  id: `polar-${airfoilId}`,
  airfoilId,
  caseName: "test",
  reynolds: 400_000,
  mach: 0,
  alphaStart: 2,
  alphaEnd: 6,
  alphaStep: 4,
  ncrit: 9,
  convergedPoints: 2,
  requestedPoints: 2,
  status,
  points: [
    { alpha: 2, cl: 0.4, cd: lowerCd, cm: 0 },
    { alpha: 6, cl: 0.8, cd: upperCd, cm: 0 },
  ],
});

const strip = (yPosition: number, halfArea: number, twist: number, airfoilInterpolation: number): WingMeshStrip => ({
  yStart: yPosition,
  yEnd: yPosition + 1,
  centerY: yPosition + 0.5,
  chord: halfArea,
  twist,
  quarterChordSweep: 0,
  dihedral: 0,
  halfArea,
  airfoilRootId: "root",
  airfoilTipId: "tip",
  airfoilInterpolation,
});

const result = {
  density: 1,
  speed: 10,
  alphaDegrees: 3,
  cdi: 0.02,
  totalLift: 90,
  aircraftSnapshot: { incidence: 0, wingArea: 6 },
  deformedMesh: { strips: [strip(0, 1, 1, 0.25), strip(1, 2, 2, 0.5)] },
};

describe("estimateAeroelasticPerformance", () => {
  it("combines interpolated section profile drag with saved induced drag", () => {
    const estimate = estimateAeroelasticPerformance(result, [polar("root", 0.01, 0.03), polar("tip", 0.02, 0.04, "needs-review")]);

    expect(estimate.available).toBe(true);
    if (!estimate.available) return;
    expect(estimate.profileDrag).toBeCloseTo(8.25);
    expect(estimate.profileCd).toBeCloseTo(0.0275);
    expect(estimate.inducedDrag).toBeCloseTo(6);
    expect(estimate.totalDrag).toBeCloseTo(14.25);
    expect(estimate.liftToDrag).toBeCloseTo(90 / 14.25);
    expect(estimate.profileDragPerLength).toEqual([
      { yPosition: 0.5, value: expect.closeTo(1.125) },
      { yPosition: 1.5, value: expect.closeTo(3) },
    ]);
    expect(estimate.usesReviewPolar).toBe(true);
  });

  it("does not invent a drag value when a section Polar is missing or outside its alpha range", () => {
    expect(estimateAeroelasticPerformance(result, [polar("root", 0.01, 0.03)])).toMatchObject({ available: false, reason: "missing-polar" });
    expect(estimateAeroelasticPerformance({ ...result, alphaDegrees: 10 }, [polar("root", 0.01, 0.03), polar("tip", 0.02, 0.04)])).toMatchObject({ available: false, reason: "alpha-out-of-range" });
  });
});
