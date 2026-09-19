import type { WingAnalysisMesh } from "../../analysis/services/wingAnalysisMesh";
import type { AircraftGeometry } from "../../aircraft/model/types";
import type { AirfoilPolar } from "../../airfoils/model/types";
import type { StaticAeroelasticResult } from "./staticAeroelasticSolver";

type PerformanceInput = Pick<StaticAeroelasticResult, "density" | "speed" | "alphaDegrees" | "cdi" | "totalLift"> & {
  aircraftSnapshot: Pick<AircraftGeometry, "incidence" | "wingArea">;
  deformedMesh: Pick<WingAnalysisMesh, "strips">;
};

type PerformanceEstimate =
  | { available: false; reason: "missing-polar" | "ambiguous-polar" | "alpha-out-of-range" | "invalid-drag" }
  | {
    available: true;
    profileCd: number;
    profileDrag: number;
    inducedDrag: number;
    totalDrag: number;
    liftToDrag: number;
    profileDragPerLength: Array<{ yPosition: number; value: number }>;
    usesReviewPolar: boolean;
  };

export function estimateAeroelasticPerformance(result: PerformanceInput, polars: readonly AirfoilPolar[]): PerformanceEstimate {
  const dynamicPressure = result.density * result.speed ** 2 / 2;
  const pressureArea = dynamicPressure * result.aircraftSnapshot.wingArea;
  if (!(pressureArea > 0) || !Number.isFinite(pressureArea) || !Number.isFinite(result.cdi)) return { available: false, reason: "invalid-drag" };

  const polarByAirfoil = new Map<string, AirfoilPolar>();
  for (const strip of result.deformedMesh.strips) {
    for (const airfoilId of [strip.airfoilRootId, strip.airfoilTipId]) {
      if (polarByAirfoil.has(airfoilId)) continue;
      const matches = polars.filter((polar) => polar.airfoilId === airfoilId && polar.points.length > 0);
      if (!matches.length) return { available: false, reason: "missing-polar" };
      if (matches.length > 1) return { available: false, reason: "ambiguous-polar" };
      polarByAirfoil.set(airfoilId, matches[0]);
    }
  }

  const profileDragPerLength: Array<{ yPosition: number; value: number }> = [];
  let halfWingProfileDrag = 0;
  for (const strip of result.deformedMesh.strips) {
    const alpha = result.alphaDegrees + result.aircraftSnapshot.incidence + strip.twist;
    const rootCd = cdAtAlpha(polarByAirfoil.get(strip.airfoilRootId)!, alpha);
    const tipCd = cdAtAlpha(polarByAirfoil.get(strip.airfoilTipId)!, alpha);
    if (rootCd === null || tipCd === null) return { available: false, reason: "alpha-out-of-range" };
    const sectionCd = rootCd + (tipCd - rootCd) * strip.airfoilInterpolation;
    if (!Number.isFinite(sectionCd) || sectionCd < 0 || !(strip.yEnd > strip.yStart)) return { available: false, reason: "invalid-drag" };
    const stripDrag = dynamicPressure * strip.halfArea * sectionCd;
    halfWingProfileDrag += stripDrag;
    profileDragPerLength.push({ yPosition: strip.centerY, value: stripDrag / (strip.yEnd - strip.yStart) });
  }

  if (!profileDragPerLength.length) return { available: false, reason: "missing-polar" };
  const profileDrag = 2 * halfWingProfileDrag;
  const inducedDrag = pressureArea * result.cdi;
  const totalDrag = profileDrag + inducedDrag;
  if (!(totalDrag > 0) || !Number.isFinite(totalDrag)) return { available: false, reason: "invalid-drag" };
  return {
    available: true,
    profileCd: profileDrag / pressureArea,
    profileDrag,
    inducedDrag,
    totalDrag,
    liftToDrag: result.totalLift / totalDrag,
    profileDragPerLength,
    usesReviewPolar: [...polarByAirfoil.values()].some((polar) => polar.status === "needs-review"),
  };
}

function cdAtAlpha(polar: AirfoilPolar, alpha: number): number | null {
  const points = [...polar.points].sort((left, right) => left.alpha - right.alpha);
  if (!points.length || alpha < points[0].alpha || alpha > points.at(-1)!.alpha) return null;
  const exact = points.find((point) => point.alpha === alpha);
  if (exact) return exact.cd;
  const upperIndex = points.findIndex((point) => point.alpha > alpha);
  if (upperIndex <= 0) return null;
  const lower = points[upperIndex - 1];
  const upper = points[upperIndex];
  return lower.cd + (upper.cd - lower.cd) * (alpha - lower.alpha) / (upper.alpha - lower.alpha);
}
