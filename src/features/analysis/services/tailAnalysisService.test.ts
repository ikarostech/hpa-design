import { describe, expect, it } from "vitest";
import type { TailSurface } from "../../aircraft/model/types";
import type { AirfoilPolar } from "../../airfoils/model/types";
import { analyzeTailSurface } from "./tailAnalysisService";

const surface: TailSurface = {
  id: "tail", name: "Horizontal tail", orientation: "horizontal", rootPosition: { x: 4, y: 0, z: 0 },
  incidence: 0, symmetric: true, isDoubleFin: false, isSymmetricFin: false,
  sections: [0, 1].map((spanPosition, index) => ({
    id: `section-${index}`, spanPosition, chord: 1, xOffset: 0, dihedral: 0, twist: 0,
    leftAirfoilId: "foil", rightAirfoilId: "foil", chordwisePanels: 1, spanwisePanels: 2,
    chordwiseDistribution: "uniform", spanwiseDistribution: "uniform",
  })),
};
const polar = (reynolds: number, cd: number, alphaStart = -10, alphaEnd = 10): AirfoilPolar => ({
  id: `polar-${reynolds}`, airfoilId: "foil", caseName: "test", reynolds, mach: 0,
  alphaStart, alphaEnd, alphaStep: 5, ncrit: 9, convergedPoints: 2, requestedPoints: 2, status: "complete",
  points: [{ alpha: alphaStart, cl: -1, cd, cm: -0.02 }, { alpha: alphaEnd, cl: 1, cd, cm: -0.02 }],
});
const condition = { speed: 10, density: 1, dynamicViscosity: 0.0001, alpha: 5, beta: 0 };

describe("analyzeTailSurface", () => {
  it("keeps inviscid lift and side loads available when no Polar is usable, without inventing profile drag", () => {
    const result = analyzeTailSurface(surface, condition, []);
    expect(result.status).toBe("inviscid-only");
    if (result.status !== "inviscid-only") return;
    expect(result.cl).toBeGreaterThan(0);
    expect(result.cdi).toBeGreaterThanOrEqual(0);
    expect(result.strips.reduce((sum, strip) => sum + strip.lift, 0)).toBeCloseTo(result.lift, 8);
    expect(result.profileCd).toBeNull();
    expect(result.cd).toBeNull();
    expect(result.drag).toBeNull();
    expect(result.issues.join(" ")).toMatch(/Polar/);
  });

  it("distinguishes a needs-review Polar with converged points from a missing Polar", () => {
    const result = analyzeTailSurface(surface, condition, [{ ...polar(100_000, 0.02), status: "needs-review" }]);
    expect(result.status).toBe("inviscid-only");
    expect(result.issues.join(" ")).toMatch(/要確認/);
    expect(result.issues.join(" ")).not.toMatch(/Polarがありません/);
  });
  it("interpolates profile drag across local Reynolds polar brackets and reports physical loads", () => {
    const splitChord = { ...surface, sections: surface.sections.map((section) => ({ ...section, chordwisePanels: 2 })) };
    const result = analyzeTailSurface(splitChord, condition, [polar(50_000, 0.01), polar(150_000, 0.03)]);
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.reference.area).toBeCloseTo(2, 10);
    expect(result.reynoldsRange).toEqual([100_000, 100_000]);
    expect(result.profileCd).toBeCloseTo(0.02, 8);
    expect(result.cd).toBeCloseTo(result.cdi + 0.02, 8);
    expect(result.lift).toBeCloseTo(result.cl * 100, 8);
    expect(result.strips).toHaveLength(4);
    expect(result.strips.reduce((sum, strip) => sum + strip.lift, 0)).toBeCloseTo(result.lift, 8);
    expect(result.polarIds).toEqual(["polar-50000", "polar-150000"]);
  });

  it("keeps partial VLM loads for missing, stale, Reynolds-outside and angle-outside Polar data", () => {
    expect(analyzeTailSurface(surface, condition, []).status).toBe("inviscid-only");
    expect(analyzeTailSurface(surface, condition, [{ ...polar(100_000, 0.02), status: "needs-review" }]).status).toBe("inviscid-only");
    expect(analyzeTailSurface(surface, condition, [polar(50_000, 0.02)]).issues.join(" ")).toMatch(/Re範囲外/);
    expect(analyzeTailSurface(surface, condition, [polar(100_000, 0.02, -2, 2)]).issues.join(" ")).toMatch(/angle|迎角/i);
    expect(analyzeTailSurface(surface, { ...condition, dynamicViscosity: 0 }, [polar(100_000, 0.02)]).issues.join(" ")).toMatch(/viscosity|粘性/i);
  });

  it("uses sideslip for fin polar coverage and reports side-force distribution", () => {
    const fin = { ...surface, orientation: "vertical" as const };
    const result = analyzeTailSurface(fin, { ...condition, alpha: 0, beta: 5 }, [polar(100_000, 0.02)]);
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(Math.abs(result.sideForce)).toBeGreaterThan(0);
    expect(result.strips.reduce((sum, strip) => sum + strip.sideForce, 0)).toBeCloseTo(result.sideForce, 8);
    expect(analyzeTailSurface(fin, { ...condition, alpha: 0, beta: 12 }, [polar(100_000, 0.02)]).status).toBe("inviscid-only");
  });

  it("rejects a legacy double fin instead of silently analyzing one fin", () => {
    const fin = { ...surface, orientation: "vertical" as const, isDoubleFin: true, rootPosition: { x: 4, y: 1, z: 0 } };
    const result = analyzeTailSurface(fin, { ...condition, alpha: 0, beta: 5 }, [polar(100_000, 0.02)]);
    expect(result.status).toBe("unsupported");
    if (result.status !== "unsupported") return;
    expect(result.issues.join(" ")).toMatch(/Double Fin.*対応/);
  });
});
