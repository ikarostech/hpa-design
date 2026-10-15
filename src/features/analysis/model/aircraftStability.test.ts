import { describe, expect, it } from "vitest";
import { summarizeAircraftStability } from "./aircraftStability";

describe("summarizeAircraftStability", () => {
  it("reports lateral derivatives at trim instead of averaging unrelated operating points", () => {
    const summary = summarizeAircraftStability([
      { alpha: 0, cl: 0.2, cm: 0.04, cnBeta: 0.08, crBeta: -0.1, cyBeta: 0.2 },
      { alpha: 4, cl: 0.6, cm: -0.04, cnBeta: 0.1, crBeta: -0.2, cyBeta: 0.4 },
      { alpha: 8, cl: 1, cm: -0.12, cnBeta: 0.8, crBeta: -1, cyBeta: 2 },
    ]);
    expect(summary.cnBetaPerRadian).toBeCloseTo(0.09);
    expect(summary.crBetaPerRadian).toBeCloseTo(-0.15);
    expect(summary.cyBetaPerRadian).toBeCloseTo(0.3);
    expect(summary.derivativeAlpha).toBeCloseTo(2);
    expect(summarizeAircraftStability([{ alpha: 3, cl: 0.2, cm: -0.04 }])).toMatchObject({
      crBetaPerRadian: null, cyBetaPerRadian: null, cnBetaPerRadian: null, derivativeAlpha: 3,
    });
  });
  it("interpolates trim and reports longitudinal and directional static derivatives", () => {
    const summary = summarizeAircraftStability([
      { alpha: 0, cl: 0.2, cm: 0.04, cnBeta: 0.08 },
      { alpha: 4, cl: 0.6, cm: -0.04, cnBeta: 0.1 },
    ]);
    expect(summary.trimAlpha).toBeCloseTo(2);
    expect(summary.trimCl).toBeCloseTo(0.4);
    expect(summary.staticMarginPercent).toBeCloseTo(20);
    expect(summary.cmAlphaPerDegree).toBeCloseTo(-0.02);
    expect(summary.cnBetaPerRadian).toBeCloseTo(0.09);
  });

  it("does not claim trim outside the sweep or stability from one point", () => {
    expect(summarizeAircraftStability([{ alpha: 0, cl: 0.2, cm: -0.04, cnBeta: 0.1 }])).toMatchObject({ trimAlpha: null, staticMarginPercent: null });
    expect(summarizeAircraftStability([{ alpha: 0, cl: 0.2, cm: -0.04 }, { alpha: 4, cl: 0.6, cm: -0.08 }]).trimAlpha).toBeNull();
  });
});
