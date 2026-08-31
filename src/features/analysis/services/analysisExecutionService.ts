import type { AircraftGeometry } from "../../aircraft/model/types";
import type { AirfoilPolar } from "../../airfoils/model/types";
import type { AnalysisCase, AnalysisResult } from "../model/types";
import { calculateLltCoefficients } from "./lltSolver";
import { airDensityAtAltitude, createLltSpanwiseDistribution, createVlmSpanwiseDistribution } from "./spanwiseDistribution";
import { calculateVlmCoefficients } from "./vlmSolver";
import { createWingAnalysisMesh, type WingAnalysisMesh } from "./wingAnalysisMesh";

export interface ExecuteAnalysisCaseInput {
  analysisCase: AnalysisCase;
  aircraft: AircraftGeometry;
  polarIds?: readonly string[];
  polars?: readonly AirfoilPolar[];
  signal?: AbortSignal;
  createId: (prefix: "analysis-result") => string;
  onProgress: (progress: { completed: number; total: number; message: string }) => void;
}

export class AnalysisExecutionCancelledError extends Error {
  constructor() {
    super("Analysis execution was cancelled.");
    this.name = "AnalysisExecutionCancelledError";
  }
}

export async function executeAnalysisCase({
  analysisCase,
  aircraft,
  polarIds = [],
  polars = [],
  signal = new AbortController().signal,
  createId,
  onProgress,
}: ExecuteAnalysisCaseInput): Promise<AnalysisResult> {
  throwIfCancelled(signal);
  const angles = createSweep(analysisCase.alphaStart, analysisCase.alphaEnd, analysisCase.alphaStep);
  const rows: AnalysisResult["rows"] = [];
  const mesh = createWingAnalysisMesh(aircraft.sections);
  const selectedPolars = selectSectionPolars(aircraft, polars, analysisCase.reynolds);
  const density = airDensityAtAltitude(analysisCase.altitude);

  for (const alpha of angles) {
    throwIfCancelled(signal);
    await yieldToUserInput();
    const coefficients = mesh.strips.length
      ? analysisCase.method === "VLM"
        ? calculateVlmWingCoefficients(alpha, aircraft, mesh, selectedPolars, analysisCase.speed, density)
        : calculateLltWingCoefficients(alpha, aircraft, mesh, selectedPolars, analysisCase.speed, density)
      : calculateFiniteWingCoefficients(alpha + aircraft.incidence, analysisCase.method, aircraft.aspectRatio);
    rows.push({
      caseId: analysisCase.id,
      alpha,
      ...coefficients,
      ld: round(safeDivide(coefficients.cl, coefficients.cd), 2),
      status: "completed",
    });
    onProgress({ completed: rows.length, total: angles.length, message: `${analysisCase.method}: ${alpha}°` });
    throwIfCancelled(signal);
  }

  return {
    id: createId("analysis-result"),
    caseId: analysisCase.id,
    clMax: Math.max(...rows.map((row) => row.cl)),
    cdMin: Math.min(...rows.map((row) => row.cd)),
    maxLD: Math.max(...rows.map((row) => row.ld)),
    cm0: rows.find((row) => row.alpha === 0)?.cm ?? interpolateCm0(rows),
    status: "completed",
    caseSnapshot: { ...analysisCase },
    aircraftSnapshot: { ...aircraft, sections: aircraft.sections.map((section) => ({ ...section })) },
    airfoilIds: Array.from(new Set(aircraft.sections.map((section) => section.airfoilId))),
    polarIds: polarIds.length ? [...polarIds] : Array.from(new Set(Array.from(selectedPolars.values(), (polar) => polar.id))),
    rows,
  };
}

function calculateLltWingCoefficients(
  alpha: number,
  aircraft: AircraftGeometry,
  mesh: WingAnalysisMesh,
  polars: Map<string, AirfoilPolar>,
  speed: number,
  density: number,
) {
  const characteristics = estimateSectionCharacteristics(polars);
  const inviscid = calculateLltCoefficients(aircraft, alpha, characteristics);
  const sectionCoefficients = sectionProfileCoefficients(alpha, aircraft, mesh, polars, "LLT");
  const profile = averageProfileCoefficients(mesh, sectionCoefficients);
  const cl = round(inviscid.cl, 4);
  const cd = round(inviscid.cdi + profile.cd, 5);
  const cm = round(profile.cm, 4);
  return {
    cl,
    cd,
    cm,
    spanwise: createLltSpanwiseDistribution({
      aircraft, mesh, alphaDegrees: alpha, speed, density, sectionCoefficients,
      targetCl: cl, targetCdi: Math.min(cd, inviscid.cdi), targetProfileCd: Math.max(0, cd - Math.min(cd, inviscid.cdi)),
      fourierCoefficients: inviscid.fourierCoefficients,
    }),
  };
}

function estimateSectionCharacteristics(polars: Map<string, AirfoilPolar>) {
  if (!polars.size) return undefined;
  const estimates = Array.from(polars.values()).map((polar) => {
    const points = [...polar.points].sort((left, right) => left.alpha - right.alpha);
    const lower = points[0];
    const upper = points[points.length - 1];
    const slopePerDegree = safeDivide(upper.cl - lower.cl, upper.alpha - lower.alpha);
    return {
      slope: slopePerDegree * 180 / Math.PI,
      zeroLiftAngle: lower.alpha - safeDivide(lower.cl, slopePerDegree),
    };
  });
  return {
    sectionLiftCurveSlope: safeDivide(estimates.reduce((sum, item) => sum + item.slope, 0), estimates.length),
    zeroLiftAngle: safeDivide(estimates.reduce((sum, item) => sum + item.zeroLiftAngle, 0), estimates.length),
  };
}

function sectionProfileCoefficients(
  alpha: number,
  aircraft: AircraftGeometry,
  mesh: WingAnalysisMesh,
  polars: Map<string, AirfoilPolar>,
  method: AnalysisCase["method"],
) {
  return mesh.strips.map((strip) => {
    const localAlpha = alpha + aircraft.incidence + strip.twist;
    const root = coefficientsAtAlpha(polars.get(strip.airfoilRootId), localAlpha, method);
    const tip = coefficientsAtAlpha(polars.get(strip.airfoilTipId), localAlpha, method);
    return polars.size ? {
      cd: interpolate(root.cd, tip.cd, strip.airfoilInterpolation),
      cm: interpolate(root.cm, tip.cm, strip.airfoilInterpolation),
    } : { cd: 0, cm: 0 };
  });
}

function averageProfileCoefficients(mesh: WingAnalysisMesh, coefficients: readonly { cd: number; cm: number }[]) {
  const totalHalfArea = mesh.strips.reduce((sum, strip) => sum + strip.halfArea, 0);
  return {
    cd: safeDivide(mesh.strips.reduce((sum, strip, index) => sum + coefficients[index].cd * strip.halfArea, 0), totalHalfArea),
    cm: safeDivide(mesh.strips.reduce((sum, strip, index) => sum + coefficients[index].cm * strip.halfArea, 0), totalHalfArea),
  };
}

function calculateVlmWingCoefficients(
  alpha: number,
  aircraft: AircraftGeometry,
  mesh: WingAnalysisMesh,
  polars: Map<string, AirfoilPolar>,
  speed: number,
  density: number,
) {
  const inviscid = calculateVlmCoefficients(aircraft, mesh, alpha);
  const sectionCoefficients = sectionProfileCoefficients(alpha, aircraft, mesh, polars, "VLM");
  const profile = averageProfileCoefficients(mesh, sectionCoefficients);
  const cl = round(inviscid.cl, 4);
  const cd = round(inviscid.cdi + profile.cd, 5);
  const cm = round(inviscid.cm + profile.cm, 4);
  return {
    cl,
    cd,
    cm,
    spanwise: createVlmSpanwiseDistribution({
      aircraft, mesh, alphaDegrees: alpha, speed, density, sectionCoefficients,
      targetCl: cl, targetCdi: Math.min(cd, inviscid.cdi), targetProfileCd: Math.max(0, cd - Math.min(cd, inviscid.cdi)),
      panelLoads: inviscid.panelLoads,
    }),
  };
}

function selectSectionPolars(aircraft: AircraftGeometry, polars: readonly AirfoilPolar[], reynolds: number) {
  const selected = new Map<string, AirfoilPolar>();
  for (const airfoilId of new Set(aircraft.sections.map((section) => section.airfoilId))) {
    const candidates = polars
      .filter((polar) => polar.airfoilId === airfoilId && polar.points.length > 0)
      .sort((left, right) => Math.abs(left.reynolds - reynolds) - Math.abs(right.reynolds - reynolds));
    if (candidates[0]) selected.set(airfoilId, candidates[0]);
  }
  return selected;
}

function coefficientsAtAlpha(polar: AirfoilPolar | undefined, alpha: number, method: AnalysisCase["method"]) {
  if (!polar?.points.length) {
    const slope = method === "LLT" ? 2 * Math.PI : 2.08 * Math.PI;
    const cl = slope * alpha * Math.PI / 180;
    return { cl, cd: 0.018 + cl ** 2 * 0.01, cm: method === "LLT" ? -0.045 : -0.04 };
  }
  const points = [...polar.points].sort((left, right) => left.alpha - right.alpha);
  if (alpha <= points[0].alpha) return points[0];
  if (alpha >= points[points.length - 1].alpha) return points[points.length - 1];
  const upperIndex = points.findIndex((point) => point.alpha >= alpha);
  const lower = points[upperIndex - 1];
  const upper = points[upperIndex];
  const ratio = safeDivide(alpha - lower.alpha, upper.alpha - lower.alpha);
  return {
    cl: interpolate(lower.cl, upper.cl, ratio),
    cd: interpolate(lower.cd, upper.cd, ratio),
    cm: interpolate(lower.cm, upper.cm, ratio),
  };
}

function createSweep(start: number, end: number, step: number) {
  const values: number[] = [];
  for (let alpha = start; alpha <= end + step / 1_000_000; alpha += step) values.push(round(alpha, 6));
  return values;
}

function calculateFiniteWingCoefficients(alpha: number, method: AnalysisCase["method"], aspectRatio: number) {
  const alphaRadians = alpha * Math.PI / 180;
  const oswaldEfficiency = method === "LLT" ? 0.9 : 0.95;
  const twoDimensionalSlope = method === "LLT" ? 2 * Math.PI : 2.08 * Math.PI;
  const liftSlope = twoDimensionalSlope / (1 + twoDimensionalSlope / (Math.PI * oswaldEfficiency * aspectRatio));
  const cl = round(liftSlope * alphaRadians, 4);
  const cd = round(0.018 + cl ** 2 / (Math.PI * oswaldEfficiency * aspectRatio), 5);
  const cm = round((method === "LLT" ? -0.045 : -0.04) - alphaRadians * 0.018, 4);
  return { cl, cd, cm };
}

function interpolateCm0(rows: AnalysisResult["rows"]) {
  const positive = rows.find((row) => row.alpha > 0);
  const negative = [...rows].reverse().find((row) => row.alpha < 0);
  if (!positive || !negative) return rows[0]?.cm ?? 0;
  return round(negative.cm + (positive.cm - negative.cm) * (-negative.alpha / (positive.alpha - negative.alpha)), 4);
}

function throwIfCancelled(signal: AbortSignal) {
  if (signal.aborted) throw new AnalysisExecutionCancelledError();
}

function round(value: number, digits: number) {
  return Number(value.toFixed(digits));
}

function interpolate(start: number, end: number, ratio: number) {
  return start + (end - start) * ratio;
}

function safeDivide(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function yieldToUserInput() {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, 20));
}
