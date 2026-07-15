import type { AircraftGeometry } from "../../aircraft/model/types";
import type { AnalysisCase, AnalysisResult } from "../model/types";

export interface ExecuteAnalysisCaseInput {
  analysisCase: AnalysisCase;
  aircraft: AircraftGeometry;
  polarIds?: readonly string[];
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
  signal = new AbortController().signal,
  createId,
  onProgress,
}: ExecuteAnalysisCaseInput): Promise<AnalysisResult> {
  throwIfCancelled(signal);
  const angles = createSweep(analysisCase.alphaStart, analysisCase.alphaEnd, analysisCase.alphaStep);
  const rows: AnalysisResult["rows"] = [];

  for (const alpha of angles) {
    throwIfCancelled(signal);
    await yieldToUserInput();
    const coefficients = calculateFiniteWingCoefficients(alpha, analysisCase.method, aircraft.aspectRatio);
    rows.push({
      caseId: analysisCase.id,
      alpha,
      ...coefficients,
      ld: round(coefficients.cl / coefficients.cd, 2),
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
    polarIds: [...polarIds],
    rows,
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

function yieldToUserInput() {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, 20));
}
